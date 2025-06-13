from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import select

from .. import __version__
from ..config import settings
from ..db.core import init_user_data
from ..deps import SessionDep, get_current_username
from ..models.models import (
    Bloc,
    BlocCategory,
    BlocCategoryRead,
    BlocRead,
    HealthWatchData,
    HealthWatchDataRead,
    Image,
    LoginRegisterModel,
    Program,
    User,
    UserRead,
)
from ..security import ensure_superuser, hash_password, verify_mfa_code
from ..utils.misc import b64e
from .programs import export_program

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserRead])
async def admin_list_users(session: SessionDep, current_user: Annotated[str, Depends(get_current_username)]):
    await ensure_superuser(session, current_user)

    users = session.exec(select(User)).all()
    return [UserRead.serialize(u) for u in users]


@router.put("/users/{username}/reset")
async def admin_reset_user_password(
    username: str,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    new: str = Body(..., embed=True),
    code: str = Body(..., embed=True),
):
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    target_user = session.get(User, username)
    if not target_user:
        raise HTTPException(status_code=404, detail="The resource does not exist")
    if target_user.is_su:
        raise HTTPException(status_code=403, detail="You cannot tamper an admin account")

    target_user.password = hash_password(new)
    session.add(target_user)
    session.commit()

    return {}


@router.put("/users/{username}/reset_mfa", response_model=UserRead)
async def admin_reset_mfa(
    username: str,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    code: str = Body(..., embed=True),
) -> UserRead:
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    target_user = session.get(User, username)
    if not target_user:
        raise HTTPException(status_code=404, detail="The resource does not exist")
    if target_user.is_su:
        raise HTTPException(status_code=403, detail="You cannot tamper an admin account")
    if not target_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Bad request")

    target_user.mfa_enabled = False
    target_user.mfa_secret = None
    session.add(target_user)
    session.commit()

    return UserRead.serialize(target_user)


@router.put("/export")
async def admin_export_data(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    code: str = Body(..., embed=True),
):
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    data = {}

    users = session.exec(select(User)).all()
    for user in users:
        username = user.username
        data[username] = {
            "_": {"at": datetime.timestamp(datetime.now()), "version": __version__},
            "categories": [
                BlocCategoryRead.serialize(c)
                for c in session.exec(select(BlocCategory).filter(BlocCategory.user == username))
            ],
            "blocs": [
                BlocRead.serialize(bloc) for bloc in session.exec(select(Bloc).filter(Bloc.user == username))
            ],
            "images": {},
            "programs": [
                export_program(program.id, session, username)
                for program in session.exec(select(Program).filter(Program.user == username))
            ],
        }

        hw_data = session.exec(
            select(HealthWatchData)
            .where(HealthWatchData.user == username)
            .order_by(HealthWatchData.cdate.desc())
        )
        data[username]["hw_data"] = [HealthWatchDataRead.serialize(r) for r in hw_data]

        images = session.exec(select(Image).where(Image.user == username))
        for im in images:
            with open(Path(settings.ASSETS_FOLDER) / im.filename, "rb") as f:
                data[username]["images"][im.id] = b64e(f.read())

    return data


@router.put("/users/{username}/toggle_active", response_model=UserRead)
async def admin_toggle_user_active(
    username: str,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    code: str = Body(..., embed=True),
) -> UserRead:
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    target_user = session.get(User, username)
    if not target_user:
        raise HTTPException(status_code=404, detail="The resource does not exist")
    if target_user.is_su:
        raise HTTPException(status_code=403, detail="You cannot tamper an admin account")

    target_user.is_active = not target_user.is_active
    session.add(target_user)
    session.commit()
    session.refresh(target_user)

    return UserRead.serialize(target_user)


@router.put("/users/{username}")
async def admin_delete_user(
    username: str,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    code: str = Body(..., embed=True),
):
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    target_user = session.get(User, username)
    if not target_user:
        raise HTTPException(status_code=404, detail="The resource does not exist")
    if target_user.is_su:
        raise HTTPException(status_code=403, detail="You cannot tamper an admin account")

    session.delete(target_user)
    session.commit()

    return {}


@router.post("/users", response_model=UserRead)
async def admin_add_user(
    req: LoginRegisterModel,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
    code: str = Body(..., embed=True),
):
    await ensure_superuser(session, current_user)

    db_user = session.get(User, current_user)
    if not db_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="Enable MFA to perform admin actions")

    success = verify_mfa_code(db_user.mfa_secret, code)
    if not success:
        raise HTTPException(status_code=403, detail="Invalid code")

    user = session.get(User, req.username)
    if user:
        raise HTTPException(status_code=409, detail="The resource already exists")

    new_user = User(username=req.username, password=hash_password(req.password))
    session.add(new_user)
    session.commit()

    init_user_data(session, new_user.username)

    return UserRead.serialize(new_user)
