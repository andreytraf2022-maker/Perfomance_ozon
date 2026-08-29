# -*- coding: utf-8 -*-
from __future__ import annotations

import csv
import io
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from functools import lru_cache
from urllib.parse import quote

from flask import Flask, Response, jsonify, request, send_from_directory

import demo

try:
    import pyodbc
except ImportError:  # pragma: no cover - локальный запуск без ODBC
    pyodbc = None

APP_DIR = os.path.dirname(os.path.abspath(__file__))
CONN_STR = os.environ.get(
    "OZON_SQL_CONN",
    (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=prdsql;"
        "DATABASE=mag_pbi;"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    ),
)

app = Flask(__name__, static_folder="static", static_url_path="/static")


def _env_flag(name):
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes"}


@lru_cache(maxsize=1)
def demo_mode():
    if _env_flag("OZON_DEMO"):
        return True
    if pyodbc is None:
        return True
    try:
        with connect() as conn:
            conn.cursor().execute("SELECT 1")
        return False
    except Exception:
        return True


def connect():
    if pyodbc is None:
        raise RuntimeError("pyodbc не установлен")
    conn = pyodbc.connect(CONN_STR, timeout=20)
    conn.timeout = 90
    return conn


def sql_scalar(cur, query, params=()):
    cur.execute(query, params)
    row = cur.fetchone()
    return None if row is None else row[0]


def rows_dicts(cur):
    cols = [c[0] for c in cur.description]
    out = []
    for row in cur.fetchall():
        item = {}
        for col, val in zip(cols, row):
            if isinstance(val, Decimal):
                val = float(val)
            elif isinstance(val, (datetime, date)):
                val = val.isoformat()
            elif isinstance(val, bytes):
                val = None
            item[col] = val
        out.append(item)
    return out


def num(v):
    if v is None:
        return 0.0
    return float(v)


def ratio(nume, deno):
    deno = num(deno)
    if deno == 0:
        return None
    return round(num(nume) / deno * 100.0, 1)


def unit_price(nume, deno):
    deno = num(deno)
    if deno == 0:
        return None
    return round(num(nume) / deno, 2)


def sum_money(vals):
    found = [num(v) for v in vals if v is not None]
    if not found:
        return None
    return round(sum(found), 2)


def parse_date(name, default=None):
    raw = (request.args.get(name) or "").strip()
    if not raw:
        return default
    return datetime.strptime(raw, "%Y-%m-%d").date()


def q_text(name):
    v = (request.args.get(name) or "").strip()
    return v or None


def _uniq(values):
    seen = set()
    out = []
    for raw in values:
        v = str(raw).strip()
        if not v:
            continue
        key = v.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(v)
    return out


def split_list(raw):
    if raw is None:
        return []
    if isinstance(raw, list):
        parts = []
        for item in raw:
            parts.extend(re.split(r"[\n,;\t]+", str(item)))
        return _uniq(parts)
    return _uniq(re.split(r"[\n,;\t]+", str(raw)))


def req_val(name, default=None):
    if request.is_json:
        body = request.get_json(silent=True) or {}
        if name in body and body[name] not in (None, ""):
            return body[name]
    return request.args.get(name, default)


def req_list(name):
    if request.is_json:
        body = request.get_json(silent=True) or {}
        if name in body:
            return split_list(body.get(name))
    vals = request.args.getlist(name)
    if not vals:
        return []
    return split_list(vals)


def each_day(start, end):
    if not start or not end:
        return []
    days = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur += timedelta(days=1)
    return days


def parse_report_request():
    mn, mx = date_bounds()
    raw_from = req_val("from")
    raw_to = req_val("to")
    date_from = (
        datetime.strptime(str(raw_from), "%Y-%m-%d").date() if raw_from else mx
    )
    date_to = datetime.strptime(str(raw_to), "%Y-%m-%d").date() if raw_to else mx
    if date_from and date_to and date_from > date_to:
        date_from, date_to = date_to, date_from

    groups1 = req_list("g")
    groups2 = req_list("g1")
    groups3 = req_list("g2")
    managers = req_list("manager")
    artic = req_list("artic")
    code = req_list("code")
    nom = req_list("nom")
    skus = req_list("sku")
    campaign_ids = req_list("campaign_id")
    body = request.get_json(silent=True) or {}
    if request.is_json and "statuses" in body:
        statuses = split_list(body.get("statuses"))
    elif request.args.getlist("statuses"):
        statuses = req_list("statuses")
    else:
        statuses = ["Активна", "Запланирована", "Приостановлена"]
    status_set = {s.strip() for s in statuses if str(s).strip()}

    extra = []
    extra_params: list = []
    add_str_filter("LTRIM(RTRIM(gr.g))", groups1, extra, extra_params, exact=True)
    add_str_filter("LTRIM(RTRIM(gr.g1))", groups2, extra, extra_params, exact=True)
    add_str_filter("LTRIM(RTRIM(gr.g2))", groups3, extra, extra_params, exact=True)
    named_managers = [m for m in managers if m != "Без менеджера"]
    want_empty_mgr = "Без менеджера" in managers
    if want_empty_mgr and named_managers:
        ph = ",".join("?" * len(named_managers))
        extra.append(
            f"(NULLIF(LTRIM(RTRIM(n.manager)), N'') IS NULL OR LTRIM(RTRIM(n.manager)) IN ({ph}))"
        )
        extra_params.extend(named_managers)
    elif want_empty_mgr:
        extra.append("NULLIF(LTRIM(RTRIM(n.manager)), N'') IS NULL")
    else:
        add_str_filter("LTRIM(RTRIM(n.manager))", named_managers, extra, extra_params, exact=True)
    add_str_filter("n.artic", artic, extra, extra_params, exact=True)
    add_str_filter("n.code", code, extra, extra_params, exact=True)
    add_str_filter(
        "COALESCE(n.description, a.nom_tbl, a.product_name)",
        nom,
        extra,
        extra_params,
        exact=True,
    )
    add_str_filter("a.sku", skus, extra, extra_params, exact=True)
    add_str_filter("a.campaign_id", campaign_ids, extra, extra_params, exact=True)
    extra_sql = (" AND " + " AND ".join(extra)) if extra else ""
    return {
        "date_from": date_from,
        "date_to": date_to,
        "extra_sql": extra_sql,
        "params": [date_from, date_to, *extra_params],
        "status_set": status_set,
        "filters": {
            "statuses": list(status_set),
            "artic": artic,
            "code": code,
            "nom": nom,
            "sku": skus,
            "campaign_id": campaign_ids,
        },
    }


SRC_CTE = """
    WITH ads AS (
        SELECT
            LTRIM(RTRIM(t.sku)) AS sku,
            LTRIM(RTRIM(CAST(t.campaign_id AS nvarchar(64)))) AS campaign_id,
            t.campaign_name,
            t.status,
            t.strategy,
            t.placement,
            t.report_date,
            CAST(ISNULL(t.sales, 0) AS decimal(18, 2)) AS sales,
            CAST(ISNULL(t.expense, 0) AS decimal(18, 2)) AS expense,
            CAST(ISNULL(t.views, 0) AS bigint) AS views,
            CAST(ISNULL(t.clicks, 0) AS bigint) AS clicks,
            CAST(ISNULL(t.to_cart, 0) AS bigint) AS to_cart,
            CAST(ISNULL(t.model_orders, 0) AS bigint) AS model_orders,
            CAST(ISNULL(t.model_sales, 0) AS decimal(18, 2)) AS model_sales,
            CAST(t.weekly_budget AS decimal(18, 2)) AS weekly_budget,
            CAST(t.date_added AS date) AS date_added,
            CAST(t.product_gmv AS decimal(18, 2)) AS product_gmv,
            t.[Номенклатура] AS nom_tbl,
            t.product_name
        FROM ext_belousov.ozon_perfomance AS t
        WHERE t.report_date >= ? AND t.report_date <= ?
    ),
    nom AS (
        SELECT
            LTRIM(RTRIM(CAST(n.[ID OZON] AS nvarchar(64)))) AS sku,
            MAX(n.description) AS description,
            MAX(n.artic) AS artic,
            MAX(LTRIM(RTRIM(n.code))) AS code,
            MAX(n.photo) AS photo,
            MAX(n.[1c_group]) AS [1c_group],
            MAX(LTRIM(RTRIM(n.[Менеджер OZON]))) AS manager
        FROM pbi.nomenclature AS n
        WHERE NULLIF(LTRIM(RTRIM(CAST(n.[ID OZON] AS nvarchar(64)))), N'') IS NOT NULL
        GROUP BY LTRIM(RTRIM(CAST(n.[ID OZON] AS nvarchar(64))))
    ),
    src AS (
        SELECT
            a.sku,
            a.campaign_id,
            a.campaign_name,
            a.status,
            a.strategy,
            a.placement,
            a.report_date,
            a.sales,
            a.expense,
            a.views,
            a.clicks,
            a.to_cart,
            a.model_orders,
            a.model_sales,
            a.weekly_budget,
            a.date_added,
            a.product_gmv,
            COALESCE(n.description, a.nom_tbl, a.product_name) AS nom_name,
            n.artic,
            n.code,
            n.photo,
            n.manager
        FROM ads AS a
        LEFT JOIN nom AS n ON n.sku = a.sku
        LEFT JOIN pbi.groups AS gr ON gr.[1c_id] = n.[1c_group]
        WHERE 1 = 1{extra_sql}
    ),
    camp_status AS (
        SELECT sku, campaign_id, status, strategy, placement
        FROM (
            SELECT
                sku,
                campaign_id,
                status,
                strategy,
                placement,
                ROW_NUMBER() OVER (
                    PARTITION BY sku, campaign_id
                    ORDER BY
                        CASE WHEN status IS NULL OR LTRIM(RTRIM(status)) = N'' THEN 1 ELSE 0 END,
                        report_date DESC
                ) AS rn
            FROM src
        ) x
        WHERE rn = 1
    )
"""


def add_str_filter(expr, values, extra, extra_params, exact=False):
    values = _uniq(values)
    if not values:
        return
    if exact or len(values) > 1:
        ph = ",".join("?" * len(values))
        extra.append(f"{expr} IN ({ph})")
        extra_params.extend(values)
    else:
        extra.append(f"{expr} LIKE ?")
        extra_params.append(f"%{values[0]}%")


@lru_cache(maxsize=1)
def date_bounds():
    if demo_mode():
        return demo.MIN_DATE, demo.MAX_DATE
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT MIN(report_date), MAX(report_date) FROM ext_belousov.ozon_perfomance"
        )
        mn, mx = cur.fetchone()
        return mn, mx


@app.get("/")
def index():
    return send_from_directory(APP_DIR, "static/index.html")


@app.get("/api/meta")
def api_meta():
    if demo_mode():
        return jsonify(demo.meta())
    mn, mx = date_bounds()
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT LTRIM(RTRIM(g.g)) AS g
            FROM pbi.groups g
            WHERE NULLIF(LTRIM(RTRIM(g.g)), '') IS NOT NULL
              AND g.g NOT LIKE N'%*%'
            ORDER BY 1
            """
        )
        groups1 = [r[0] for r in cur.fetchall()]
        cur.execute(
            """
            SELECT DISTINCT LTRIM(RTRIM(n.[Менеджер OZON])) AS mgr
            FROM pbi.nomenclature AS n
            WHERE NULLIF(LTRIM(RTRIM(n.[Менеджер OZON])), N'') IS NOT NULL
            ORDER BY 1
            """
        )
        managers = [r[0] for r in cur.fetchall()]
    managers = ["Без менеджера", *managers]
    return jsonify(
        {
            "demo": False,
            "min_date": mn.isoformat() if mn else None,
            "max_date": mx.isoformat() if mx else None,
            "groups1": groups1,
            "managers": managers,
        }
    )


def _args_list(name):
    if request.is_json:
        body = request.get_json(silent=True) or {}
        if name in body:
            return split_list(body.get(name))
    return split_list(request.args.getlist(name) or request.args.get(name))


@app.get("/api/groups")
@app.post("/api/groups")
def api_groups():
    gs = _args_list("g")
    g1s = _args_list("g1")
    if not gs:
        return jsonify([])
    if demo_mode():
        return jsonify(demo.groups(gs, g1s))
    with connect() as conn:
        cur = conn.cursor()
        g_ph = ",".join("?" * len(gs))
        if not g1s:
            cur.execute(
                f"""
                SELECT DISTINCT LTRIM(RTRIM(g1)) AS val
                FROM pbi.groups
                WHERE LTRIM(RTRIM(g)) IN ({g_ph})
                  AND NULLIF(LTRIM(RTRIM(g1)), '') IS NOT NULL
                  AND g NOT LIKE N'%*%'
                ORDER BY 1
                """,
                gs,
            )
        else:
            g1_ph = ",".join("?" * len(g1s))
            cur.execute(
                f"""
                SELECT DISTINCT LTRIM(RTRIM(g2)) AS val
                FROM pbi.groups
                WHERE LTRIM(RTRIM(g)) IN ({g_ph})
                  AND LTRIM(RTRIM(g1)) IN ({g1_ph})
                  AND NULLIF(LTRIM(RTRIM(g2)), '') IS NOT NULL
                  AND g NOT LIKE N'%*%'
                ORDER BY 1
                """,
                [*gs, *g1s],
            )
        return jsonify([r[0] for r in cur.fetchall()])


@app.get("/api/products")
@app.post("/api/products")
def api_products():
    ctx = parse_report_request()
    date_from = ctx["date_from"]
    date_to = ctx["date_to"]
    extra_sql = ctx["extra_sql"]
    params = ctx["params"]
    status_set = ctx["status_set"]

    if demo_mode():
        return jsonify(demo.products(date_from, date_to, ctx["filters"]))

    sql = SRC_CTE.format(extra_sql=extra_sql).rstrip() + """,
    sku_gmv AS (
        SELECT sku, SUM(day_gmv) AS gmv
        FROM (
            SELECT sku, report_date, MAX(product_gmv) AS day_gmv
            FROM src
            GROUP BY sku, report_date
        ) d
        GROUP BY sku
    ),
    sku_agg AS (
        SELECT
            sku,
            MAX(nom_name) AS nom_name,
            MAX(artic) AS artic,
            MAX(code) AS code,
            MAX(photo) AS photo,
            SUM(sales) AS sales,
            SUM(expense) AS expense,
            SUM(views) AS views,
            SUM(clicks) AS clicks
        FROM src
        GROUP BY sku
    ),
    camp_agg AS (
        SELECT
            sku,
            campaign_id,
            MAX(campaign_name) AS campaign_name,
            SUM(sales) AS sales,
            SUM(expense) AS expense,
            SUM(views) AS views,
            SUM(clicks) AS clicks,
            SUM(to_cart) AS to_cart,
            SUM(model_orders) AS model_orders,
            SUM(model_sales) AS model_sales,
            MAX(weekly_budget) AS budget,
            MIN(date_added) AS date_added
        FROM src
        GROUP BY sku, campaign_id
    )
    SELECT
        a.sku,
        a.nom_name,
        a.artic,
        a.code,
        a.photo,
        a.sales,
        a.expense,
        a.views,
        a.clicks,
        g.gmv,
        c.campaign_id,
        c.campaign_name,
        s.status,
        s.strategy,
        s.placement,
        c.sales AS camp_sales,
        c.expense AS camp_expense,
        c.views AS camp_views,
        c.clicks AS camp_clicks,
        c.to_cart AS camp_to_cart,
        c.model_orders AS camp_model_orders,
        c.model_sales AS camp_model_sales,
        c.budget AS camp_budget,
        c.date_added AS camp_date_added
    FROM sku_agg AS a
    LEFT JOIN sku_gmv AS g ON g.sku = a.sku
    INNER JOIN camp_agg AS c ON c.sku = a.sku
    LEFT JOIN camp_status AS s
        ON s.sku = c.sku AND s.campaign_id = c.campaign_id
    ORDER BY a.expense DESC, a.sku, c.expense DESC;
    """

    with connect() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        raw = rows_dicts(cur)

    products: dict[str, dict] = {}
    order: list[str] = []
    for row in raw:
        sku = row["sku"]
        if sku not in products:
            sales = num(row["sales"])
            expense = num(row["expense"])
            gmv = None if row["gmv"] is None else round(num(row["gmv"]), 2)
            products[sku] = {
                "sku": sku,
                "name": row["nom_name"] or sku,
                "artic": row["artic"],
                "code": row["code"],
                "photo": row["photo"],
                "sales": round(sales, 2),
                "expense": round(expense, 2),
                "views": int(num(row["views"])),
                "clicks": int(num(row["clicks"])),
                "drr": ratio(expense, sales),
                "general_drr": ratio(expense, gmv),
                "gmv": gmv,
                "campaigns": {
                    "active": [],
                    "planned": [],
                    "paused": [],
                    "inactive": [],
                    "done": [],
                    "other": [],
                },
            }
            order.append(sku)

        if not row["campaign_id"]:
            continue
        camp_sales = num(row["camp_sales"])
        camp_expense = num(row["camp_expense"])
        camp_views = int(num(row["camp_views"]))
        camp_clicks = int(num(row["camp_clicks"]))
        camp_to_cart = int(num(row["camp_to_cart"]))
        camp_budget = None if row["camp_budget"] is None else round(num(row["camp_budget"]), 2)
        gmv = None if row["gmv"] is None else round(num(row["gmv"]), 2)
        status = (row["status"] or "").strip()
        if status not in status_set:
            continue
        camp = {
            "id": row["campaign_id"],
            "name": row["campaign_name"] or row["campaign_id"],
            "status": status,
            "strategy": (row.get("strategy") or "").strip() or None,
            "placement": (row.get("placement") or "").strip() or None,
            "sales": round(camp_sales, 2),
            "expense": round(camp_expense, 2),
            "views": camp_views,
            "clicks": camp_clicks,
            "to_cart": camp_to_cart,
            "model_orders": int(num(row["camp_model_orders"])),
            "model_sales": round(num(row["camp_model_sales"]), 2),
            "budget": camp_budget,
            "date_added": row["camp_date_added"],
            "gmv": gmv,
            "ctr": ratio(camp_clicks, camp_views),
            "cpc": unit_price(camp_expense, camp_clicks),
            "drr": ratio(camp_expense, camp_sales),
            "general_drr": ratio(camp_expense, gmv),
        }
        if status == "Активна":
            products[sku]["campaigns"]["active"].append(camp)
        elif status == "Запланирована":
            products[sku]["campaigns"]["planned"].append(camp)
        elif status == "Приостановлена":
            products[sku]["campaigns"]["paused"].append(camp)
        elif status == "Неактивна":
            products[sku]["campaigns"]["inactive"].append(camp)
        elif status == "Завершена":
            products[sku]["campaigns"]["done"].append(camp)
        else:
            products[sku]["campaigns"]["other"].append(camp)

    items = []
    for sku in order:
        p = products[sku]
        camps = (
            p["campaigns"]["active"]
            + p["campaigns"]["planned"]
            + p["campaigns"]["paused"]
            + p["campaigns"]["inactive"]
            + p["campaigns"]["done"]
            + p["campaigns"]["other"]
        )
        if not camps:
            continue
        p["sales"] = round(sum(c["sales"] for c in camps), 2)
        p["expense"] = round(sum(c["expense"] for c in camps), 2)
        p["views"] = sum(c["views"] for c in camps)
        p["clicks"] = sum(c["clicks"] for c in camps)
        p["to_cart"] = sum(c["to_cart"] for c in camps)
        p["model_orders"] = sum(c["model_orders"] for c in camps)
        p["model_sales"] = round(sum(c["model_sales"] for c in camps), 2)
        p["budget"] = sum_money(c["budget"] for c in camps)
        added = [c["date_added"] for c in camps if c.get("date_added")]
        p["date_added"] = max(added) if added else None
        p["drr"] = ratio(p["expense"], p["sales"])
        p["general_drr"] = ratio(p["expense"], p.get("gmv"))
        p["ctr"] = ratio(p["clicks"], p["views"])
        p["cpc"] = unit_price(p["expense"], p["clicks"])
        items.append(p)
    tot_sales = sum(p["sales"] for p in items)
    tot_exp = sum(p["expense"] for p in items)
    tot_views = sum(p["views"] for p in items)
    tot_clicks = sum(p["clicks"] for p in items)
    tot_cart = sum(p["to_cart"] for p in items)
    tot_model_orders = sum(p["model_orders"] for p in items)
    tot_model_sales = round(sum(p["model_sales"] for p in items), 2)
    tot_gmv = round(sum(num(p.get("gmv")) for p in items), 2)

    return jsonify(
        {
            "from": date_from.isoformat() if date_from else None,
            "to": date_to.isoformat() if date_to else None,
            "count": len(items),
            "totals": {
                "sales": round(tot_sales, 2),
                "expense": round(tot_exp, 2),
                "views": tot_views,
                "clicks": tot_clicks,
                "to_cart": tot_cart,
                "model_orders": tot_model_orders,
                "model_sales": tot_model_sales,
                "budget": sum_money(p.get("budget") for p in items),
                "gmv": tot_gmv,
                "date_added": None,
                "drr": ratio(tot_exp, tot_sales),
                "general_drr": ratio(tot_exp, tot_gmv),
                "ctr": ratio(tot_clicks, tot_views),
                "cpc": unit_price(tot_exp, tot_clicks),
            },
            "items": items,
        }
    )


def empty_chart(date_from, date_to, demo=False):
    days = each_day(date_from, date_to)
    blank = _metrics_from_acc({})
    return {
        "demo": demo,
        "from": date_from.isoformat() if date_from else None,
        "to": date_to.isoformat() if date_to else None,
        "series": [
            {
                "id": "total",
                "kind": "total",
                "name": "Итого",
                "points": [{"date": d.isoformat(), **blank} for d in days],
            }
        ],
    }


def _metrics_from_acc(acc):
    sales = num(acc.get("sales"))
    expense = num(acc.get("expense"))
    views = num(acc.get("views"))
    clicks = num(acc.get("clicks"))
    gmv = num(acc.get("gmv"))
    return {
        "sales": round(sales, 2),
        "expense": round(expense, 2),
        "views": int(views),
        "clicks": int(clicks),
        "to_cart": int(num(acc.get("to_cart"))),
        "model_orders": int(num(acc.get("model_orders"))),
        "model_sales": round(num(acc.get("model_sales")), 2),
        "budget": round(num(acc.get("budget")), 2),
        "gmv": round(gmv, 2),
        "drr": ratio(expense, sales),
        "general_drr": ratio(expense, gmv),
        "ctr": ratio(clicks, views),
        "cpc": unit_price(expense, clicks),
    }


def _add_into(dst, src, gmv="sum"):
    for key in (
        "sales",
        "expense",
        "views",
        "clicks",
        "to_cart",
        "model_orders",
        "model_sales",
        "budget",
    ):
        dst[key] = num(dst.get(key)) + num(src.get(key))
    if gmv == "max":
        dst["gmv"] = max(num(dst.get("gmv")), num(src.get("gmv")))
    else:
        dst["gmv"] = num(dst.get("gmv")) + num(src.get("gmv"))


def _points_from_days(days, by_date):
    out = []
    for d in days:
        out.append({"date": d.isoformat(), **_metrics_from_acc(by_date.get(d.isoformat()) or {})})
    return out


def pack_chart_series(date_from, date_to, rows):
    days = each_day(date_from, date_to)
    camps: dict[tuple[str, str], dict] = {}
    for row in rows:
        sku = str(row.get("sku") or "").strip()
        camp_id = str(row.get("campaign_id") or "").strip()
        if not sku or not camp_id:
            continue
        day = row["report_date"]
        day_s = day.isoformat()[:10] if hasattr(day, "isoformat") else str(day)[:10]
        item = camps.setdefault(
            (sku, camp_id),
            {
                "sku": sku,
                "campaign_id": camp_id,
                "name": row.get("campaign_name") or camp_id,
                "nom_name": row.get("nom_name") or sku,
                "vals": {},
            },
        )
        if row.get("campaign_name"):
            item["name"] = row["campaign_name"]
        if row.get("nom_name"):
            item["nom_name"] = row["nom_name"]
        acc = item["vals"].setdefault(day_s, {})
        _add_into(acc, row, gmv="max")

    sku_days: dict[str, dict] = {}
    sku_names: dict[str, str] = {}
    for (sku, camp_id), item in camps.items():
        sku_names[sku] = item["nom_name"]
        by_day = sku_days.setdefault(sku, {})
        for day_s, acc in item["vals"].items():
            dst = by_day.setdefault(day_s, {})
            _add_into(dst, acc, gmv="max")

    total_days: dict[str, dict] = {}
    for by_day in sku_days.values():
        for day_s, acc in by_day.items():
            dst = total_days.setdefault(day_s, {})
            _add_into(dst, acc, gmv="sum")

    series = [
        {
            "id": "total",
            "kind": "total",
            "name": "Итого",
            "points": _points_from_days(days, total_days),
        }
    ]
    sku_ranked = sorted(
        sku_days.items(),
        key=lambda kv: -sum(num(acc.get("expense")) for acc in kv[1].values()),
    )
    for sku, by_day in sku_ranked:
        series.append(
            {
                "id": sku,
                "kind": "sku",
                "name": sku_names.get(sku) or sku,
                "points": _points_from_days(days, by_day),
            }
        )
    camp_ranked = sorted(
        camps.values(),
        key=lambda item: -sum(num(acc.get("expense")) for acc in item["vals"].values()),
    )
    for item in camp_ranked:
        series.append(
            {
                "id": f"camp:{item['sku']}:{item['campaign_id']}",
                "kind": "campaign",
                "name": item["name"],
                "points": _points_from_days(days, item["vals"]),
            }
        )
    return series


@app.get("/api/chart")
@app.post("/api/chart")
def api_chart():
    ctx = parse_report_request()
    date_from = ctx["date_from"]
    date_to = ctx["date_to"]
    if demo_mode():
        return jsonify(demo.chart(date_from, date_to, ctx["filters"]))

    status_set = ctx["status_set"]
    if not date_from or not date_to or not status_set:
        return jsonify(empty_chart(date_from, date_to))

    status_list = list(status_set)
    status_ph = ",".join("?" * len(status_list))
    sql = SRC_CTE.format(extra_sql=ctx["extra_sql"]).rstrip() + f"""
    SELECT
        s.sku,
        s.campaign_id,
        MAX(s.campaign_name) AS campaign_name,
        MAX(s.nom_name) AS nom_name,
        CAST(s.report_date AS date) AS report_date,
        SUM(s.sales) AS sales,
        SUM(s.expense) AS expense,
        SUM(s.views) AS views,
        SUM(s.clicks) AS clicks,
        SUM(s.to_cart) AS to_cart,
        SUM(s.model_orders) AS model_orders,
        SUM(s.model_sales) AS model_sales,
        MAX(s.weekly_budget) AS budget,
        MAX(s.product_gmv) AS gmv
    FROM src AS s
    INNER JOIN camp_status AS cs
        ON cs.sku = s.sku AND cs.campaign_id = s.campaign_id
    WHERE LTRIM(RTRIM(ISNULL(cs.status, N''))) IN ({status_ph})
    GROUP BY s.sku, s.campaign_id, CAST(s.report_date AS date)
    ORDER BY s.sku, s.campaign_id, CAST(s.report_date AS date);
    """
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(sql, [*ctx["params"], *status_list])
        raw = rows_dicts(cur)
    return jsonify(
        {
            "demo": False,
            "from": date_from.isoformat(),
            "to": date_to.isoformat(),
            "series": pack_chart_series(date_from, date_to, raw),
        }
    )


EXPORT_HEADERS = [
    "Дата",
    "Тип",
    "SKU",
    "Артикул",
    "Код",
    "Наименование",
    "Менеджер",
    "ID кампании",
    "Кампания",
    "Статус",
    "Стратегия",
    "Размещение",
    "Бюджет РК, ₽",
    "Всего заказано, ₽",
    "Заказано по рек., ₽",
    "Расход, ₽",
    "ДРР по рекл., %",
    "ДРР общий, %",
    "Показы",
    "Клики",
    "CPC",
    "CTR",
    "Добавлено в корзину",
    "Модельные заказы",
    "Модельные продажи, ₽",
    "Дата добавления товара",
]


def _csv_num(v, nd=2):
    if v is None:
        return ""
    n = float(v)
    if nd == 0:
        return str(int(round(n)))
    s = f"{n:.{nd}f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def _csv_date(v):
    if not v:
        return ""
    if hasattr(v, "strftime"):
        return v.strftime("%d.%m.%Y")
    s = str(v)[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return s


def _export_line(kind, day, meta, metrics, camp=None):
    sales = num(metrics.get("sales"))
    expense = num(metrics.get("expense"))
    views = num(metrics.get("views"))
    clicks = num(metrics.get("clicks"))
    gmv = metrics.get("gmv")
    gmv_n = None if gmv is None else num(gmv)
    drr = ratio(expense, sales)
    general_drr = ratio(expense, gmv_n)
    ctr = ratio(clicks, views)
    cpc = unit_price(expense, clicks)
    camp = camp or {}
    return [
        _csv_date(day),
        kind,
        meta.get("sku") or "",
        meta.get("artic") or "",
        meta.get("code") or "",
        meta.get("name") or "",
        meta.get("manager") or "",
        camp.get("id") or "",
        camp.get("name") or "",
        camp.get("status") or "",
        camp.get("strategy") or "",
        camp.get("placement") or "",
        _csv_num(metrics.get("budget")),
        _csv_num(gmv_n),
        _csv_num(sales),
        _csv_num(expense),
        "" if drr is None else _csv_num(drr, 1),
        "" if general_drr is None else _csv_num(general_drr, 1),
        _csv_num(views, 0),
        _csv_num(clicks, 0),
        "" if cpc is None else _csv_num(cpc),
        "" if ctr is None else _csv_num(ctr, 1),
        _csv_num(metrics.get("to_cart"), 0),
        _csv_num(metrics.get("model_orders"), 0),
        _csv_num(metrics.get("model_sales")),
        _csv_date(meta.get("date_added") if kind == "Товар" else camp.get("date_added")),
    ]


def pack_export_rows(raw):
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    sku_meta: dict[str, dict] = {}
    for row in raw:
        sku = str(row.get("sku") or "").strip()
        camp_id = str(row.get("campaign_id") or "").strip()
        if not sku or not camp_id:
            continue
        day = row.get("report_date")
        day_s = day.isoformat()[:10] if hasattr(day, "isoformat") else str(day)[:10]
        groups[(sku, day_s)].append(row)
        prev = sku_meta.get(sku) or {}
        sku_meta[sku] = {
            "sku": sku,
            "name": row.get("nom_name") or prev.get("name") or sku,
            "artic": row.get("artic") or prev.get("artic"),
            "code": row.get("code") or prev.get("code"),
            "manager": row.get("manager") or prev.get("manager"),
            "date_added": row.get("date_added") or prev.get("date_added"),
            "expense": num(prev.get("expense")) + num(row.get("expense")),
        }

    sku_order = sorted(sku_meta, key=lambda s: -sku_meta[s]["expense"])
    rows = []
    for sku in sku_order:
        days = sorted({day for s, day in groups if s == sku})
        meta = sku_meta[sku]
        for day_s in days:
            camps = groups[(sku, day_s)]
            acc = {
                "sales": 0.0,
                "expense": 0.0,
                "views": 0.0,
                "clicks": 0.0,
                "to_cart": 0.0,
                "model_orders": 0.0,
                "model_sales": 0.0,
                "budget": 0.0,
                "gmv": 0.0,
            }
            for c in camps:
                _add_into(acc, c, gmv="max")
            rows.append(_export_line("Товар", day_s, meta, acc))
            for c in sorted(camps, key=lambda x: str(x.get("campaign_id") or "")):
                camp = {
                    "id": str(c.get("campaign_id") or ""),
                    "name": c.get("campaign_name") or c.get("campaign_id"),
                    "status": (c.get("status") or "").strip(),
                    "strategy": (c.get("strategy") or "").strip(),
                    "placement": (c.get("placement") or "").strip(),
                    "date_added": c.get("date_added"),
                }
                rows.append(_export_line("Кампания", day_s, meta, c, camp))
    return rows


def export_csv_bytes(headers, rows):
    buf = io.StringIO()
    buf.write("\ufeff")
    writer = csv.writer(buf, delimiter=";", lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


@app.post("/api/export")
def api_export():
    ctx = parse_report_request()
    date_from = ctx["date_from"]
    date_to = ctx["date_to"]
    if not date_from or not date_to:
        return jsonify({"error": "Укажите период"}), 400
    if demo_mode():
        rows = pack_export_rows(demo.export_raw(date_from, date_to, ctx["filters"]))
    else:
        status_set = ctx["status_set"]
        if not status_set:
            rows = []
        else:
            status_list = list(status_set)
            status_ph = ",".join("?" * len(status_list))
            sql = SRC_CTE.format(extra_sql=ctx["extra_sql"]).rstrip() + f"""
    SELECT
        s.sku,
        s.campaign_id,
        MAX(s.campaign_name) AS campaign_name,
        MAX(s.nom_name) AS nom_name,
        MAX(s.artic) AS artic,
        MAX(s.code) AS code,
        MAX(s.manager) AS manager,
        MAX(cs.status) AS status,
        MAX(cs.strategy) AS strategy,
        MAX(cs.placement) AS placement,
        CAST(s.report_date AS date) AS report_date,
        SUM(s.sales) AS sales,
        SUM(s.expense) AS expense,
        SUM(s.views) AS views,
        SUM(s.clicks) AS clicks,
        SUM(s.to_cart) AS to_cart,
        SUM(s.model_orders) AS model_orders,
        SUM(s.model_sales) AS model_sales,
        MAX(s.weekly_budget) AS budget,
        MAX(s.product_gmv) AS gmv,
        MIN(s.date_added) AS date_added
    FROM src AS s
    INNER JOIN camp_status AS cs
        ON cs.sku = s.sku AND cs.campaign_id = s.campaign_id
    WHERE LTRIM(RTRIM(ISNULL(cs.status, N''))) IN ({status_ph})
    GROUP BY s.sku, s.campaign_id, CAST(s.report_date AS date)
    ORDER BY s.sku, CAST(s.report_date AS date), s.campaign_id;
    """
            with connect() as conn:
                cur = conn.cursor()
                cur.execute(sql, [*ctx["params"], *status_list])
                raw = rows_dicts(cur)
            rows = pack_export_rows(raw)
    filename = f"ozon-performance_{date_from.isoformat()}_{date_to.isoformat()}.csv"
    payload = export_csv_bytes(EXPORT_HEADERS, rows)
    return Response(
        payload,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
            "X-Export-Rows": str(len(rows)),
        },
    )


if __name__ == "__main__":
    date_bounds.cache_clear()
    demo_mode.cache_clear()
    host = os.environ.get("OZON_HOST", "0.0.0.0")
    port = int(os.environ.get("OZON_PORT", "8765"))
    app.run(host=host, port=port, debug=False, threaded=True)
