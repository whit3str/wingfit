import base64
from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from .. import __version__
from ..config import settings
from ..deps import SessionDep, get_current_username
from ..models.models import (
    Bloc,
    BlocCategory,
    BlocCategoryRead,
    BlocRead,
    HealthWatchData,
    HealthWatchDataRead,
    Image,
    Program,
    User,
    UserRead,
)
from ..utils.misc import check_update, generate_api_token
from .programs import export_program

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=UserRead)
async def get_user_settings(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]
) -> UserRead:
    db_user = session.get(User, current_user)
    return UserRead.serialize(db_user)


@router.get("/export")
def export_user_data(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]
):
    data = {
        "_": {"at": datetime.timestamp(datetime.now()), "version": __version__},
        "categories": [
            BlocCategoryRead.serialize(c)
            for c in session.exec(select(BlocCategory).filter(BlocCategory.user == current_user))
        ],
        "blocs": [
            BlocRead.serialize(bloc)
            for bloc in session.exec(select(Bloc).filter(Bloc.user == current_user))
        ],
        "images": {},
        "programs": [
            export_program(program.id, session, current_user)
            for program in session.exec(select(Program).filter(Program.user == current_user))
        ],
    }

    hw_data = session.exec(
        select(HealthWatchData)
        .where(HealthWatchData.user == current_user)
        .order_by(HealthWatchData.cdate.desc())
    )
    data["hw_data"] = [HealthWatchDataRead.serialize(r) for r in hw_data]

    images = session.exec(select(Image).where(Image.user == current_user))
    for im in images:
        with open(Path(settings.ASSETS_FOLDER) / im.filename, "rb") as f:
            data["images"][im.id] = base64.b64encode(f.read())

    return data


@router.get("/checkversion")
def check_version(session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]):
    return check_update()


@router.put("/api_token")
def generate_user_api_token(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]
) -> str:
    db_user = session.get(User, current_user)
    if db_user.api_token:
        raise HTTPException(status_code=400, detail="Bad request")
        # TODO: Token already init

    token = generate_api_token()
    setattr(db_user, "api_token", token)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return token


@router.delete("/api_token")
def delete_user_api_token(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]
):
    db_user = session.get(User, current_user)
    if not db_user.api_token:
        raise HTTPException(status_code=400, detail="Bad request")
        # TODO: No Token

    setattr(db_user, "api_token", None)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return {}
