import csv
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import extract
from sqlmodel import func, select

from ..deps import SessionDep, get_current_username
from ..models.models import (
    Bloc,
    BlocCategory,
    BlocRead,
    HealthWatchData,
    HealthWatchDataRead,
)
from ..utils.date import parse_str_or_date_to_date
from ..utils.file import download_file, upload_f_to_tempfile
from ..utils.logging import app_logger

router = APIRouter(prefix="/api/stats", tags=["statistics"])


@router.get("/notes", response_model=list[BlocRead])
def get_blocs_note(session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]) -> list:
    category = session.exec(
        select(BlocCategory)
        .where(BlocCategory.user == current_user)
        .where(BlocCategory.name == "note")
        .options(selectinload(BlocCategory.blocs))
    ).one_or_none()

    if not category:
        return []

    return [BlocRead.serialize(c) for c in category.blocs]


@router.get("/week_duration_total")
def get_total_duration_per_week(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    year: str | int | None = None,
) -> list:
    year = int(year) if year else datetime.now().year

    query = (
        select(
            extract("week", Bloc.cdate).label("week"),
            extract("year", Bloc.cdate).label("year"),
            func.sum(Bloc.duration).label("duration"),
        )
        .where(Bloc.user == current_user)
        .where(Bloc.duration.isnot(None))
        .where(extract("year", Bloc.cdate) == year)
        .group_by("year", "week")
    )

    results = session.exec(query).all()
    return [{"week": r.week, "duration": r.duration} for r in results]


@router.get("/week_duration")
def get_category_duration_per_week(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    year: str | int | None = None,
) -> list:
    year = int(year) if year else datetime.now().year

    query = (
        select(
            extract("week", Bloc.cdate).label("week"),
            extract("year", Bloc.cdate).label("year"),
            BlocCategory.name.label("category"),
            func.sum(Bloc.duration).label("duration"),
            BlocCategory.color.label("color"),
            BlocCategory.weight.label("weight"),
        )
        .join(BlocCategory, Bloc.category_id == BlocCategory.id)
        .where(Bloc.user == current_user)
        .where(Bloc.duration.isnot(None))
        .where(extract("year", Bloc.cdate) == year)
        .group_by("year", "week", "category")
    )

    results = session.exec(query).all()

    category_data = {}

    for r in results:
        category_data.setdefault(
            r.category,
            {"color": r.color, "order": r.weight, "data": {w: 0 for w in range(0, 52)}},
        )

        category_data[r.category]["data"][r.week] = r.duration

    datasets = [
        {
            "label": category.upper(),
            "order": category_data[category]["order"],
            "backgroundColor": category_data[category]["color"],
            "data": [category_data[category]["data"][week] for week in range(0, 52)],
        }
        for category in category_data
    ]

    return datasets


@router.get("/healthwatch", response_model=list[HealthWatchDataRead])
def get_hw_data(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    year: str | int | None = None,
) -> list[HealthWatchDataRead]:
    year = int(year) if year else datetime.now().year

    query = (
        select(HealthWatchData)
        .where(HealthWatchData.user == current_user)
        .where(extract("year", HealthWatchData.cdate) == year)
        .order_by(HealthWatchData.cdate.desc())
    )

    results = session.exec(query).all()
    return [HealthWatchDataRead.serialize(r) for r in results]


@router.post("/whoop_archive")
async def post_whoop_archive(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    file: UploadFile | None = File(None),
    link: str | None = Form(None),
):
    if not file and not link:
        app_logger.error(f"[post_whoop_archive][{current_user}] No link / file provided")
        raise HTTPException(status_code=400, detail="Bad request")

    if link and not link.startswith("https://links.prod.whoop.com/"):
        app_logger.error(f"[post_whoop_archive][{current_user}] Whoop export URL looks incorrect")
        raise HTTPException(status_code=400, detail="Bad request")

    temporary_fp = ""
    if file:
        temporary_fp = await upload_f_to_tempfile(file)
    else:
        temporary_fp = await download_file(link)

    inserted = 0
    with zipfile.ZipFile(temporary_fp, "r") as whoop_archive:
        if "physiological_cycles.csv" not in whoop_archive.namelist():
            app_logger.error(
                f"[post_whoop_archive][{current_user}] physiological_cycles.csv is missing in archive"
            )
            raise HTTPException(status_code=400, detail="Bad request")

        with whoop_archive.open("physiological_cycles.csv") as file:
            reader = csv.reader((line.decode("utf-8") for line in file), delimiter=",")
            next(reader)

            existing_records = {
                record.cdate: record
                for record in session.exec(
                    select(HealthWatchData).where(HealthWatchData.user == current_user)
                ).all()
            }  # {date: HealthWatchData}

            for row in reader:
                if (
                    not row or not row[3] or not row[8]
                ):  # Recovery or strain missing indicates the row is incomplete
                    continue

                # Use 'awake' datetime because 'cycle' datetimes are gapped if you sleep late or miss a night, not the best solution but a quickwin
                date_value = parse_str_or_date_to_date(row[13].split(" ")[0])
                if date_value in existing_records:
                    existing_record = existing_records[date_value]

                    if existing_record.recovery != row[3]:
                        existing_record.recovery = row[3]
                        updated = True
                    if existing_record.strain != row[8]:
                        existing_record.strain = row[8]
                        updated = True
                    if existing_record.resting_hr != row[4]:
                        existing_record.resting_hr = row[4]
                        updated = True
                    if existing_record.hrv != row[5]:
                        existing_record.hrv = row[5]
                        updated = True
                    if existing_record.temperature != row[6]:
                        existing_record.temperature = row[6]
                        updated = True
                    if existing_record.oxy_level != row[7]:
                        existing_record.oxy_level = row[7]
                        updated = True
                    if existing_record.sleep_score != row[14]:
                        existing_record.sleep_score = row[14]
                        updated = True
                    if existing_record.sleep_duration_light != row[18]:
                        existing_record.sleep_duration_light = row[18]
                        updated = True
                    if existing_record.sleep_duration_deep != row[19]:
                        existing_record.sleep_duration_deep = row[19]
                        updated = True
                    if existing_record.sleep_duration_rem != row[20]:
                        existing_record.sleep_duration_rem = row[20]
                        updated = True
                    if existing_record.sleep_duration_awake != row[21]:
                        existing_record.sleep_duration_awake = row[21]
                        updated = True
                    if existing_record.sleep_efficiency != row[24]:
                        existing_record.sleep_efficiency = row[24]
                        updated = True

                    if updated:
                        session.add(existing_record)
                    continue

                new_whoop_data = HealthWatchData(
                    cdate=date_value,
                    user=current_user,
                    recovery=row[3],
                    strain=row[8],
                    resting_hr=row[4],
                    hrv=row[5],
                    temperature=row[6],
                    oxy_level=row[7],
                    sleep_score=row[14],
                    sleep_duration_light=row[18],
                    sleep_duration_deep=row[19],
                    sleep_duration_rem=row[20],
                    sleep_duration_awake=row[21],
                    sleep_efficiency=row[24],
                )
                session.add(new_whoop_data)

        inserted = len(session.new)
        session.commit()
    Path(temporary_fp).unlink()

    return {"count": inserted}
