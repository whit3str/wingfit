from typing import Annotated

import jwt
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import select

from ..config import settings
from ..db.core import init_user_data
from ..deps import SessionDep, get_current_username
from ..models.models import LoginRegisterModel, Token, UpdateUserPassword, User
from ..security import create_access_token, create_tokens, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(req: LoginRegisterModel, session: SessionDep) -> Token:
    if settings.AUTH_METHOD == "oidc":
        raise HTTPException(status_code=400, detail="Bad request")
        # TODO: Local Authentication is disabled

    user = session.get(User, req.username)
    if not user or not user.is_active:
        # TODO: NotFound
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(req.password, user.password):
        # TODO: Invalid pw
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return create_tokens(data={"sub": user.username})


@router.post("/register", response_model=Token)
async def register(req: LoginRegisterModel, session: SessionDep) -> Token:
    if settings.AUTH_METHOD == "oidc":
        raise HTTPException(status_code=400, detail="Bad request")
        # TODO: Local Authentication is disabled

    user = session.get(User, req.username)
    if user:
        # TODO: Username already exists
        raise HTTPException(status_code=409, detail="The resource already exists")

    is_first = not session.execute(select(User).limit(1)).first()

    new_user = User(username=req.username, password=hash_password(req.password), is_su=is_first)
    session.add(new_user)
    session.commit()

    init_user_data(session, new_user.username)

    return create_tokens(data={"sub": new_user.username})


@router.post("/update_password")
async def auth_update_password(
    data: UpdateUserPassword,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_username)],
):
    db_user = session.get(User, current_user)

    if not verify_password(data.current, db_user.password):
        # TODO: Incorrect current password
        raise HTTPException(status_code=403, detail="Invalid credentials")

    db_user.password = hash_password(data.new)
    session.add(db_user)
    session.commit()

    return {}


@router.post("/refresh")
async def refresh_token(refresh_token: str = Body(..., embed=True)):
    if not refresh_token:
        # TODO: Refresh token expected
        raise HTTPException(status_code=400, detail="Bad request")

    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub", None)

        if username is None:
            raise HTTPException(status_code=401, detail="Invalid Token")
            # TODO: Invalid refresh token

        new_access_token = create_access_token(data={"sub": username})

        return {"access_token": new_access_token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invalid Token")
        # TODO: Refresh token expired
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")
        # TODO: Invalid refresh token
