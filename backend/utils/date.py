from datetime import date

from fastapi import HTTPException


def parse_str_or_date_to_date(cdate: str | date) -> date:
    if isinstance(cdate, str):
        try:
            return date.fromisoformat(cdate)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    return cdate
