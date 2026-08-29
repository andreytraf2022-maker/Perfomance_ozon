# Аналитика продвижения Ozon

Веб-кабинет по рекламе Ozon Performance: товары, кампании, ДРР, показы, клики и фильтры по периоду, статусу, группам 1С и менеджерам.

Исходный код — репозиторий [andreytraf2022-maker/Perfomance_ozon](https://github.com/andreytraf2022-maker/Perfomance_ozon).

## Запуск

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Откройте http://127.0.0.1:8765

Порт и хост можно задать переменными `OZON_PORT` и `OZON_HOST`.

## Данные

В рабочей сети кабинет читает SQL Server (`prdsql` / база `mag_pbi`, таблица `ext_belousov.ozon_perfomance`) через `pyodbc` и ODBC Driver 17 for SQL Server.

Если SQL Server недоступен (как в этой среде), приложение само переключается в **демо-режим** с учебными товарами и кампаниями. Принудительно:

```bash
OZON_DEMO=1 python app.py
```

Строку подключения можно переопределить через `OZON_SQL_CONN`.
