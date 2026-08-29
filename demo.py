# -*- coding: utf-8 -*-
"""Локальные демо-данные, если SQL Server недоступен."""
from __future__ import annotations

from copy import deepcopy
from datetime import date, timedelta
import math

MIN_DATE = date(2026, 8, 1)
MAX_DATE = date(2026, 8, 29)

GROUPS = {
    "Бытовая техника": {
        "Кухня": ["Блендеры", "Чайники", "Мультиварки"],
        "Уход за собой": ["Фены", "Эпиляторы"],
    },
    "Электроника": {
        "Аудио": ["Наушники", "Колонки"],
        "Аксессуары": ["Кабели", "Зарядки"],
    },
    "Дом и сад": {
        "Текстиль": ["Постельное бельё", "Полотенца"],
        "Хранение": ["Контейнеры", "Органайзеры"],
    },
}

MANAGERS = ["Иванова А.С.", "Петров Д.И.", "Смирнова К.В."]

_PRODUCTS = [
    {
        "sku": "1520345678",
        "name": "Блендер погружной Kitfort KT-1363, 1000 Вт",
        "artic": "KT-1363",
        "code": "00-00001234",
        "photo": None,
        "gmv": 428900,
        "campaigns": {
            "active": [
                {
                    "id": "1200451",
                    "name": "Трафареты — блендеры поиск",
                    "status": "Активна",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 86400,
                    "expense": 12480,
                    "views": 184500,
                    "clicks": 4120,
                    "to_cart": 860,
                    "model_orders": 34,
                    "model_sales": 22100,
                    "budget": 25000,
                    "date_added": "2026-08-04",
                },
                {
                    "id": "1200510",
                    "name": "Рекомендации — кухня август",
                    "status": "Активна",
                    "strategy": "Средняя стоимость клика",
                    "placement": "Поиск и рекомендации",
                    "sales": 41200,
                    "expense": 8900,
                    "views": 96500,
                    "clicks": 1880,
                    "to_cart": 410,
                    "model_orders": 12,
                    "model_sales": 7800,
                    "budget": 15000,
                    "date_added": "2026-08-12",
                },
            ],
            "planned": [
                {
                    "id": "1200888",
                    "name": "Сентябрь — блендеры",
                    "status": "Запланирована",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 0,
                    "expense": 0,
                    "views": 0,
                    "clicks": 0,
                    "to_cart": 0,
                    "model_orders": 0,
                    "model_sales": 0,
                    "budget": 18000,
                    "date_added": "2026-08-25",
                }
            ],
            "paused": [],
            "inactive": [],
            "done": [],
            "other": [],
        },
    },
    {
        "sku": "1678901234",
        "name": "Наушники беспроводные Soundcore Anker P20i",
        "artic": "A3949G11",
        "code": "00-00004567",
        "photo": None,
        "gmv": 612400,
        "campaigns": {
            "active": [
                {
                    "id": "1189002",
                    "name": "Аудио — наушники CPC",
                    "status": "Активна",
                    "strategy": "Средняя стоимость клика",
                    "placement": "Поиск и рекомендации",
                    "sales": 156800,
                    "expense": 21450,
                    "views": 310200,
                    "clicks": 7340,
                    "to_cart": 1520,
                    "model_orders": 58,
                    "model_sales": 41200,
                    "budget": 40000,
                    "date_added": "2026-08-01",
                }
            ],
            "planned": [],
            "paused": [
                {
                    "id": "1189110",
                    "name": "Выходные — наушники",
                    "status": "Приостановлена",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 9800,
                    "expense": 2100,
                    "views": 24100,
                    "clicks": 410,
                    "to_cart": 70,
                    "model_orders": 4,
                    "model_sales": 2100,
                    "budget": 8000,
                    "date_added": "2026-08-08",
                }
            ],
            "inactive": [],
            "done": [
                {
                    "id": "1175001",
                    "name": "Июль — запуск P20i",
                    "status": "Завершена",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 48200,
                    "expense": 7600,
                    "views": 88000,
                    "clicks": 1920,
                    "to_cart": 340,
                    "model_orders": 16,
                    "model_sales": 9800,
                    "budget": 12000,
                    "date_added": "2026-07-15",
                }
            ],
            "other": [],
        },
    },
    {
        "sku": "1432109876",
        "name": "Чайник электрический Xiaomi Mi Electric Kettle 2",
        "artic": "MJDSH04YM",
        "code": "00-00007890",
        "photo": None,
        "gmv": 198700,
        "campaigns": {
            "active": [],
            "planned": [],
            "paused": [
                {
                    "id": "1193008",
                    "name": "Кухня — чайники",
                    "status": "Приостановлена",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 22400,
                    "expense": 5400,
                    "views": 67200,
                    "clicks": 980,
                    "to_cart": 210,
                    "model_orders": 8,
                    "model_sales": 4100,
                    "budget": 10000,
                    "date_added": "2026-08-10",
                }
            ],
            "inactive": [
                {
                    "id": "1193012",
                    "name": "Черновик — чайник",
                    "status": "Неактивна",
                    "strategy": None,
                    "placement": None,
                    "sales": 0,
                    "expense": 0,
                    "views": 0,
                    "clicks": 0,
                    "to_cart": 0,
                    "model_orders": 0,
                    "model_sales": 0,
                    "budget": None,
                    "date_added": "2026-08-18",
                }
            ],
            "done": [],
            "other": [],
        },
    },
    {
        "sku": "1784563210",
        "name": "Комплект постельного белья Togas Luna, евро",
        "artic": "TG-LUNA-EU",
        "code": "00-00009112",
        "photo": None,
        "gmv": 334000,
        "campaigns": {
            "active": [
                {
                    "id": "1210004",
                    "name": "Текстиль — бельё поиск",
                    "status": "Активна",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 71800,
                    "expense": 9800,
                    "views": 142300,
                    "clicks": 2650,
                    "to_cart": 530,
                    "model_orders": 21,
                    "model_sales": 15600,
                    "budget": 20000,
                    "date_added": "2026-08-06",
                }
            ],
            "planned": [],
            "paused": [],
            "inactive": [],
            "done": [],
            "other": [],
        },
    },
    {
        "sku": "1900123456",
        "name": "Фен Dyson Supersonic HD08",
        "artic": "HD08-NIC",
        "code": "00-00005501",
        "photo": None,
        "gmv": 890500,
        "campaigns": {
            "active": [
                {
                    "id": "1224401",
                    "name": "Premium — фены",
                    "status": "Активна",
                    "strategy": "Средняя стоимость клика",
                    "placement": "Поиск и рекомендации",
                    "sales": 245000,
                    "expense": 38200,
                    "views": 98000,
                    "clicks": 1560,
                    "to_cart": 290,
                    "model_orders": 18,
                    "model_sales": 98000,
                    "budget": 50000,
                    "date_added": "2026-08-03",
                }
            ],
            "planned": [
                {
                    "id": "1224490",
                    "name": "1 сентября — уход",
                    "status": "Запланирована",
                    "strategy": "Автостратегия",
                    "placement": "Поиск",
                    "sales": 0,
                    "expense": 0,
                    "views": 0,
                    "clicks": 0,
                    "to_cart": 0,
                    "model_orders": 0,
                    "model_sales": 0,
                    "budget": 30000,
                    "date_added": "2026-08-27",
                }
            ],
            "paused": [],
            "inactive": [],
            "done": [],
            "other": [],
        },
    },
]


def _ratio(nume, deno):
    deno = float(deno or 0)
    if deno == 0:
        return None
    return round(float(nume or 0) / deno * 100.0, 1)


def _unit(nume, deno):
    deno = float(deno or 0)
    if deno == 0:
        return None
    return round(float(nume or 0) / deno, 2)


def _sum_money(vals):
    found = [float(v) for v in vals if v is not None]
    if not found:
        return None
    return round(sum(found), 2)


def _enrich_campaign(camp, gmv):
    c = dict(camp)
    c["gmv"] = gmv
    c["ctr"] = _ratio(c["clicks"], c["views"])
    c["cpc"] = _unit(c["expense"], c["clicks"])
    c["drr"] = _ratio(c["expense"], c["sales"])
    c["general_drr"] = _ratio(c["expense"], gmv)
    return c


def _enrich_product(raw):
    p = deepcopy(raw)
    gmv = p.get("gmv")
    camps = []
    for key in ("active", "planned", "paused", "inactive", "done", "other"):
        p["campaigns"][key] = [_enrich_campaign(c, gmv) for c in p["campaigns"].get(key, [])]
        camps.extend(p["campaigns"][key])
    p["sales"] = round(sum(c["sales"] for c in camps), 2)
    p["expense"] = round(sum(c["expense"] for c in camps), 2)
    p["views"] = sum(c["views"] for c in camps)
    p["clicks"] = sum(c["clicks"] for c in camps)
    p["to_cart"] = sum(c["to_cart"] for c in camps)
    p["model_orders"] = sum(c["model_orders"] for c in camps)
    p["model_sales"] = round(sum(c["model_sales"] for c in camps), 2)
    p["budget"] = _sum_money(c["budget"] for c in camps)
    added = [c["date_added"] for c in camps if c.get("date_added")]
    p["date_added"] = max(added) if added else None
    p["drr"] = _ratio(p["expense"], p["sales"])
    p["general_drr"] = _ratio(p["expense"], gmv)
    p["ctr"] = _ratio(p["clicks"], p["views"])
    p["cpc"] = _unit(p["expense"], p["clicks"])
    return p


PRODUCTS = [_enrich_product(p) for p in _PRODUCTS]


def meta():
    return {
        "demo": True,
        "min_date": MIN_DATE.isoformat(),
        "max_date": MAX_DATE.isoformat(),
        "groups1": list(GROUPS.keys()),
        "managers": ["Без менеджера", *MANAGERS],
    }


def groups(g_values, g1_values):
    if not g_values:
        return []
    if not g1_values:
        out = []
        for g in g_values:
            out.extend((GROUPS.get(g) or {}).keys())
        return sorted(set(out))
    out = []
    for g in g_values:
        level2 = GROUPS.get(g) or {}
        for g1 in g1_values:
            out.extend(level2.get(g1) or [])
    return sorted(set(out))


def _match_list(value, selected):
    if not selected:
        return True
    if value is None:
        return False
    needle = str(value).strip().casefold()
    return any(str(v).strip().casefold() == needle for v in selected)


def products(date_from, date_to, filters):
    statuses = set(filters.get("statuses") or [])
    items = []
    for p in PRODUCTS:
        if not _match_list(p.get("artic"), filters.get("artic")):
            continue
        if not _match_list(p.get("code"), filters.get("code")):
            continue
        if not _match_list(p.get("name"), filters.get("nom")):
            continue
        if not _match_list(p.get("sku"), filters.get("sku")):
            continue
        item = deepcopy(p)
        camp_ids = filters.get("campaign_id") or []
        for key in ("active", "planned", "paused", "inactive", "done", "other"):
            item["campaigns"][key] = [
                c
                for c in item["campaigns"][key]
                if (not statuses or c["status"] in statuses)
                and _match_list(c["id"], camp_ids)
            ]
        camps = [c for key in item["campaigns"] for c in item["campaigns"][key]]
        if not camps:
            continue
        item["sales"] = round(sum(c["sales"] for c in camps), 2)
        item["expense"] = round(sum(c["expense"] for c in camps), 2)
        item["views"] = sum(c["views"] for c in camps)
        item["clicks"] = sum(c["clicks"] for c in camps)
        item["to_cart"] = sum(c["to_cart"] for c in camps)
        item["model_orders"] = sum(c["model_orders"] for c in camps)
        item["model_sales"] = round(sum(c["model_sales"] for c in camps), 2)
        item["budget"] = _sum_money(c["budget"] for c in camps)
        added = [c["date_added"] for c in camps if c.get("date_added")]
        item["date_added"] = max(added) if added else None
        item["drr"] = _ratio(item["expense"], item["sales"])
        item["general_drr"] = _ratio(item["expense"], item.get("gmv"))
        item["ctr"] = _ratio(item["clicks"], item["views"])
        item["cpc"] = _unit(item["expense"], item["clicks"])
        items.append(item)

    tot_sales = sum(p["sales"] for p in items)
    tot_exp = sum(p["expense"] for p in items)
    tot_views = sum(p["views"] for p in items)
    tot_clicks = sum(p["clicks"] for p in items)
    tot_cart = sum(p["to_cart"] for p in items)
    tot_model_orders = sum(p["model_orders"] for p in items)
    tot_model_sales = round(sum(p["model_sales"] for p in items), 2)
    tot_gmv = round(sum(float(p.get("gmv") or 0) for p in items), 2)
    return {
        "demo": True,
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
            "budget": _sum_money(p.get("budget") for p in items),
            "gmv": tot_gmv,
            "date_added": None,
            "drr": _ratio(tot_exp, tot_sales),
            "general_drr": _ratio(tot_exp, tot_gmv),
            "ctr": _ratio(tot_clicks, tot_views),
            "cpc": _unit(tot_exp, tot_clicks),
        },
        "items": items,
    }


def _day_weights(days, phase):
    n = len(days)
    out = []
    for i, d in enumerate(days):
        t = i / max(n - 1, 1)
        if t < 0.22:
            w = 0.32 + 3.1 * t
        elif t < 0.72:
            w = 0.96 + 0.07 * math.sin((t * 9) + phase)
        else:
            w = 1.03 - 0.32 * ((t - 0.72) / 0.28)
        if d.weekday() >= 5:
            w *= 0.82
        out.append(max(w, 0.06))
    return out


def _distribute(total, weights):
    total = float(total or 0)
    if not weights:
        return []
    s = sum(weights)
    raw = [total * w / s for w in weights]
    rounded = [round(v, 2) for v in raw]
    drift = round(total - sum(rounded), 2)
    if rounded:
        rounded[-1] = round(rounded[-1] + drift, 2)
        if rounded[-1] < 0:
            rounded[-1] = 0.0
    return rounded


def chart(date_from, date_to, filters):
    payload = products(date_from, date_to, filters)
    days = []
    if date_from and date_to:
        cur = date_from
        while cur <= date_to:
            days.append(cur)
            cur += timedelta(days=1)
    series = []
    total_pts = [0.0] * len(days)
    for idx, item in enumerate(payload["items"]):
        weights = _day_weights(days, idx * 0.7)
        values = _distribute(item.get("expense") or 0, weights)
        for i, val in enumerate(values):
            total_pts[i] += val
        series.append(
            {
                "id": item["sku"],
                "name": item["name"],
                "points": [
                    {"date": days[i].isoformat(), "value": values[i]}
                    for i in range(len(days))
                ],
            }
        )
    series.insert(
        0,
        {
            "id": "total",
            "name": "Итого",
            "points": [
                {"date": days[i].isoformat(), "value": round(total_pts[i], 2)}
                for i in range(len(days))
            ],
        },
    )
    return {
        "demo": True,
        "from": date_from.isoformat() if date_from else None,
        "to": date_to.isoformat() if date_to else None,
        "metric": "expense",
        "metric_label": "Расход, ₽",
        "series": series,
    }
