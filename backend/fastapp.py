import base64
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal

import jwt
from argon2 import PasswordHasher
from argon2 import exceptions as argon_exceptions
from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import (
    Field,
    Relationship,
    Session,
    SQLModel,
    create_engine,
    delete,
    select,
)

from . import __version__
from .models import *
from .utils import (
    assets_folder_path,
    b64_decode,
    check_update,
    generate_api_token,
    generate_filename,
    parse_str_or_date_to_date,
    remove_image,
    save_image,
)

settings = Settings()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/api/assets", StaticFiles(directory=settings.ASSETS_FOLDER), name="static")
app.engine = create_engine(
    f"sqlite:///{settings.SQLITE_FILE}", connect_args={"check_same_thread": False}
)

@app.middleware("http")
async def NotFound_to_SPA(request: Request, call_next):
    response = await call_next(request)

    # Check if it's a 404 AND the request is NOT for API or static assets
    if response.status_code == 404 and not request.url.path.startswith(("/api")):
        return FileResponse(settings.FRONTEND_FOLDER + "/index.html")

    return response


def get_session():
    with Session(app.engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
ph = PasswordHasher()


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep
) -> str:
    credentials_exception = HTTPException(
        status_code=401, detail="Could not validate Token"
    )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub", None)
        if username is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = session.get(User, username)
    if user is None:
        raise credentials_exception
    return user.username


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> Literal[True]:
    try:
        return ph.verify(hashed_password, plain_password)
    except argon_exceptions.VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid password provided")
    except argon_exceptions.VerificationError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    except argon_exceptions.InvalidHashError:
        raise HTTPException(
            status_code=401, detail="Could not validate credentials, hash is invalid"
        )


def create_tokens(data: dict) -> Token:
    return Token(
        access_token=create_access_token(data), refresh_token=create_refresh_token(data)
    )


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_exists_and_owns(username: str, obj) -> None:
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")

    if obj.user != username:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return None


def init_user_data(session: SessionDep, username: str):
    categories = [
        {"user": username, "name": "note", "color": "#909090", "weight": 1},
        {"user": username, "name": "(p)rehab", "color": "#18a773", "weight": 2},
        {"user": username, "name": "weightlifting", "color": "#9d2a24", "weight": 3},
        {"user": username, "name": "gym", "color": "#e75480", "weight": 4},
        {"user": username, "name": "metcon", "color": "#3c74c4", "weight": 5},
        {"user": username, "name": "engine", "color": "#9629bf", "weight": 6},
        {"user": username, "name": "swim", "color": "#ccb012", "weight": 7},
        {"user": username, "name": "run", "color": "#308DA1", "weight": 8},
        {"user": username, "name": "bike", "color": "#61390f", "weight": 9},
        {"user": username, "name": "accessory", "color": "#c88a89", "weight": 10},
        {"user": username, "name": "mobility", "color": "#4a18a7", "weight": 11},
    ]

    for c in categories:
        category = BlocCategory(**c)
        session.add(category)
        session.flush()
    session.commit()


def api_token_to_user(session: SessionDep, api_token: str) -> User:
    user = session.exec(
        select(User).where(User.api_token != None, User.api_token == api_token)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return user


@app.on_event("startup")
def on_startup():
    try:
        SQLModel.metadata.create_all(app.engine)
    except Exception:
        print('No need to create DB, already exists')


@app.get("/api/info")
def info():
    return {"version": __version__}


@app.get("/api/stash", response_model=list[StashRead])
def read_stash(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> list[StashRead]:
    stash = session.exec(select(Stash).filter(Stash.user == current_user))
    return [StashRead.serialize(elem) for elem in stash]


@app.post("/api/stash")
def create_stash(
    stash_data: StashBase,
    session: SessionDep,
    X_Api_Token: Annotated[str | None, Header()] = None,
) -> dict:
    user = api_token_to_user(session, X_Api_Token)
    new_stash = Stash(content=stash_data.content, user=user.username)
    session.add(new_stash)
    session.commit()
    session.refresh(new_stash)
    return {}


@app.delete("/api/stash/{stash_id}")
def delete_stash(
    session: SessionDep,
    stash_id: int,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_stash = session.get(Stash, stash_id)
    verify_exists_and_owns(current_user, db_stash)

    session.delete(db_stash)
    session.commit()
    return {}


@app.delete("/api/stash")
def delete_stash(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> dict:
    session.exec(delete(Stash).where(Stash.user == current_user))
    session.commit()
    return {}


@app.get("/api/categories", response_model=list[BlocCategoryRead])
def read_categories(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> list[BlocCategoryRead]:
    categories = session.exec(
        select(BlocCategory).filter(BlocCategory.user == current_user)
    )
    return [BlocCategoryRead.serialize(category) for category in categories]


@app.post("/api/categories", response_model=BlocCategoryRead)
def create_category(
    category: BlocCategoryBase,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> BlocCategoryRead:
    new_category = BlocCategory(
        name=category.name,
        color=category.color,
        weight=category.weight,
        user=current_user,
    )
    session.add(new_category)
    session.commit()
    session.refresh(new_category)
    return BlocCategoryRead.serialize(new_category)


@app.put("/api/categories/{category_id}", response_model=BlocCategoryRead)
def update_category(
    session: SessionDep,
    category_id: int,
    category: BlocCategoryBase,
    current_user: Annotated[str, Depends(get_current_user)],
) -> BlocCategoryRead:
    db_category = session.get(BlocCategory, category_id)
    verify_exists_and_owns(current_user, db_category)

    category_data = category.model_dump(exclude_unset=True)
    for key, value in category_data.items():
        setattr(db_category, key, value)

    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return BlocCategoryRead.serialize(db_category)


@app.delete("/api/categories/{category_id}")
def delete_category(
    session: SessionDep,
    category_id: int,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_category = session.get(BlocCategory, category_id)
    verify_exists_and_owns(current_user, db_category)

    if read_category_blocs_cnt(session, category_id, current_user) > 0:
        raise HTTPException(status_code=409, detail="Category in use")

    session.delete(db_category)
    session.commit()
    return {}


@app.get("/api/categories/{category_id}/count")
def read_category_blocs_cnt(
    session: SessionDep,
    category_id: int,
    current_user: Annotated[str, Depends(get_current_user)],
) -> int:
    db_category = session.get(BlocCategory, category_id)
    verify_exists_and_owns(current_user, db_category)
    return len(db_category.blocs) + len(db_category.programblocs)


@app.get("/api/templates", response_model=list[TemplateRead])
def read_templates(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> list[TemplateRead]:
    templates = session.exec(select(Template).filter(Template.user == current_user))
    return [TemplateRead.serialize(template) for template in templates]


@app.post("/api/templates", response_model=TemplateRead)
def create_template(
    template_data: Template,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> TemplateRead:
    new_template = Template(
        content=template_data.content,
        duration=template_data.duration,
        category_id=template_data.category_id,
        user=current_user,
    )
    session.add(new_template)
    session.commit()
    session.refresh(new_template)
    return TemplateRead.serialize(new_template)


@app.put("/api/templates/{template_id}", response_model=TemplateRead)
def update_template(
    session: SessionDep,
    template_id: int,
    template: TemplateBase,
    current_user: Annotated[str, Depends(get_current_user)],
) -> TemplateRead:
    db_template = session.get(Template, template_id)
    verify_exists_and_owns(current_user, db_template)

    template_data = template.model_dump(exclude_unset=True)
    for key, value in template_data.items():
        setattr(db_template, key, value)

    session.add(db_template)
    session.commit()
    session.refresh(db_template)
    return TemplateRead.serialize(db_template)


@app.delete("/api/templates/{template_id}")
def delete_template(
    session: SessionDep,
    template_id: int,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_template = session.get(Template, template_id)
    verify_exists_and_owns(current_user, db_template)

    session.delete(db_template)
    session.commit()
    return {}


@app.get("/api/blocs", response_model=list[BlocRead])
def read_blocs(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
    startdate: str | None = None,
    enddate: str | None = None,
    limit: int = 0,
    offset: int = 0,
) -> list[BlocRead]:
    startdate = parse_str_or_date_to_date(startdate) if startdate else None
    enddate = parse_str_or_date_to_date(enddate) if enddate else None
    if startdate and enddate and startdate > enddate:
        raise HTTPException(status_code=400, detail="Provided dates are incoherent")

    query = (
        select(Bloc)
        .where(Bloc.user == current_user)
        .options(selectinload(Bloc.category))
    )
    if startdate:
        query = query.where(Bloc.cdate >= startdate)

    if enddate:
        query = query.where(Bloc.cdate <= enddate)

    if offset:
        query = query.offset(offset)

    if limit:
        query = query.limit(limit)

    blocs = session.exec(query)
    return [BlocRead.serialize(bloc) for bloc in blocs]


@app.post("/api/blocs", response_model=BlocRead | list[BlocRead])
def create_bloc(
    bloc_data: BlocCreate | list[BlocCreate],
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> BlocRead | list[BlocRead]:
    if not isinstance(bloc_data, list):
        bloc_data = [bloc_data]

    blocs = []
    for bloc in bloc_data:
        if not bloc.category and not bloc.category_id:
            raise HTTPException(status_code=400, detail="No Category provided")

        new_bloc = Bloc(
            content=bloc.content,
            duration=bloc.duration,
            cdate=parse_str_or_date_to_date(bloc.cdate),
            user=current_user,
        )

        # category_id prioritized
        if bloc.category_id:
            new_bloc.category_id = bloc.category_id

        # Else we retrieve category.id for bloc.category_id
        else:
            new_bloc.category_id = bloc.category.id

        # TODO: Handle brand_id icon
        session.add(new_bloc)
        blocs.append(new_bloc)

    session.commit()
    if len(blocs) == 1:
        return BlocRead.serialize(blocs[0])
    return [BlocRead.serialize(bloc) for bloc in blocs]


@app.put("/api/blocs/{bloc_id}", response_model=BlocRead)
def update_bloc(
    session: SessionDep,
    bloc_id: int,
    bloc: BlocUpdate,
    current_user: Annotated[str, Depends(get_current_user)],
) -> BlocRead:
    db_bloc = session.get(Bloc, bloc_id)
    verify_exists_and_owns(current_user, db_bloc)

    # TODO: Handle brand_id icon
    # TODO: Handle result key
    bloc_data = bloc.model_dump(exclude_unset=True)
    if bloc_data.get("category"):
        bloc_data["category_id"] = bloc_data.get("category").get("id")
        bloc_data.pop("category")

    if bloc_data.get("cdate"):
        bloc_data["cdate"] = parse_str_or_date_to_date(bloc_data.get("cdate"))

    for key, value in bloc_data.items():
        setattr(db_bloc, key, value)

    session.add(db_bloc)
    session.commit()
    session.refresh(db_bloc)
    return BlocRead.serialize(db_bloc)


@app.delete("/api/blocs/{bloc_id}")
def delete_bloc(
    session: SessionDep,
    bloc_id: int,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_bloc = session.get(Bloc, bloc_id)
    verify_exists_and_owns(current_user, db_bloc)

    session.delete(db_bloc)
    session.commit()
    return {}


@app.put("/api/blocs/{bloc_id}/result", response_model=BlocResultRead)
def update_bloc_result(
    bloc_id: int,
    result: BlocResultBase,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> BlocResultRead:
    # Used for POST and PUT, as I ensure the frontend always sends the full object

    db_bloc = session.get(Bloc, bloc_id)
    verify_exists_and_owns(current_user, db_bloc)

    new_result = BlocResult(key=result.key, value=result.value, comment=result.comment)
    session.add(new_result)
    db_bloc.result = new_result

    session.commit()
    session.refresh(db_bloc)
    return BlocResultRead.serialize(new_result)


@app.delete("/api/blocs/{bloc_id}/result")
def delete_bloc_result(
    bloc_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_bloc = session.get(Bloc, bloc_id)
    verify_exists_and_owns(current_user, db_bloc)

    if not db_bloc.result:
        raise HTTPException(status_code=404, detail="Bloc result not found")

    session.delete(db_bloc.result)
    db_bloc.result = None
    session.commit()
    return {}


@app.get("/api/pr", response_model=list[PRRead])
def read_prs(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> list[PRRead]:
    prs = session.exec(
        select(PR).where(PR.user == current_user).options(selectinload(PR.values))
    )
    return [PRRead.serialize(pr) for pr in prs]


@app.post("/api/pr", response_model=PRRead)
def create_pr(
    pr_data: PRCreate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> PRRead:
    new_pr = PR(name=pr_data.name, key=pr_data.key, user=current_user)
    if pr_data.key not in {item.value for item in ResultKeyEnum}:
        raise HTTPException(
            status_code=400, detail="Invalid key: kg, rep or time accepted."
        )

    if pr_data.values:
        try:
            pr_values = []
            for value in pr_data.values:
                try:
                    parsed_date = parse_str_or_date_to_date(value.cdate)
                    if parsed_date > date.today():
                        raise HTTPException(
                            status_code=400, detail=f"PR Value cannot be in the future."
                        )

                    if not PRValueCreateOrUpdate.value_matches_record_key(
                        new_pr.key, value.value
                    ):
                        raise HTTPException(
                            status_code=400, detail=f"Invalid value for PR"
                        )

                    pr_values.append(
                        PRValue(value=value.value, cdate=parsed_date, pr=new_pr)
                    )
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

            new_pr.values = pr_values

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    session.add(new_pr)
    session.commit()
    session.refresh(new_pr)
    return PRRead.serialize(new_pr)


@app.put("/api/pr/{pr_id}", response_model=PRRead)
def update_pr(
    pr_id: int,
    pr_data: PRUpdate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> PRRead:
    db_pr = session.get(PR, pr_id)
    verify_exists_and_owns(current_user, db_pr)

    pr_data = pr_data.model_dump(exclude_unset=True)

    if pr_data.get("key") and (
        pr_data.key not in {item.value for item in ResultKeyEnum}
    ):
        raise HTTPException(
            status_code=400, detail="Invalid key: kg, rep or time accepted."
        )

    for key, value in pr_data.items():
        setattr(db_pr, key, value)

    session.add(db_pr)
    session.commit()
    session.refresh(db_pr)
    return PRRead.serialize(db_pr)


@app.delete("/api/pr/{pr_id}")
def delete_pr(
    pr_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_pr = session.get(PR, pr_id)
    verify_exists_and_owns(current_user, db_pr)
    session.delete(db_pr)
    session.commit()
    return {}


@app.post("/api/pr/{pr_id}/values", response_model=list[PRValueRead])
def create_pr_value(
    pr_id: int,
    value_data: PRValueCreateOrUpdate | list[PRValueCreateOrUpdate],
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> list[PRValueRead]:
    db_pr = session.get(PR, pr_id)
    verify_exists_and_owns(current_user, db_pr)

    if not isinstance(value_data, list):
        value_data = [value_data]

    values = []
    for value in value_data:
        try:
            parsed_date = parse_str_or_date_to_date(value.cdate)
            if parsed_date > date.today():
                raise HTTPException(
                    status_code=400, detail=f"PR Value cannot be in the future"
                )

            if not PRValueCreateOrUpdate.value_matches_record_key(
                db_pr.key, value.value
            ):
                raise HTTPException(status_code=400, detail=f"Invalid value for PR")

            existing_value = session.exec(
                select(PRValue).where(
                    PRValue.pr_id == pr_id, PRValue.cdate == parsed_date
                )
            ).first()
            if existing_value:
                raise HTTPException(
                    status_code=409, detail="PR Value with this date already exists"
                )

            new_pr_value = PRValue(value=value.value, cdate=parsed_date, pr=db_pr)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        session.add(new_pr_value)
        values.append(new_pr_value)

    session.commit()
    return [PRValueRead.serialize(v) for v in values]


@app.put("/api/pr/{pr_id}/value/{value_id}", response_model=PRValueRead)
def update_pr_value(
    pr_id: int,
    value_id: int,
    value_data: PRValueCreateOrUpdate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> PRValueRead:
    db_pr = session.get(PR, pr_id)
    verify_exists_and_owns(current_user, db_pr)

    db_pr_value = session.get(PRValue, value_id)
    if not db_pr_value:
        raise HTTPException(status_code=404, detail="PR Value not found")

    if db_pr_value.pr_id != pr_id:
        raise HTTPException(
            status_code=400, detail="PR Value does not belong to the specified PR"
        )

    if not PRValueCreateOrUpdate.value_matches_record_key(db_pr.key, value_data.value):
        raise HTTPException(status_code=400, detail=f"Invalid value for PR")

    value_data = value_data.model_dump(exclude_unset=True)

    # Ensure that cdate string is converted to date obj
    if "cdate" in value_data:
        parsed_date = parse_str_or_date_to_date(value_data["cdate"])
        existing_value = session.exec(
            select(PRValue).where(
                PRValue.pr_id == pr_id,
                PRValue.cdate == parsed_date,
                PRValue.id != value_id,
            )
        ).first()
        if existing_value:
            raise HTTPException(
                status_code=409, detail="PR Value with this date already exists"
            )
        value_data["cdate"] = parsed_date

    for key, value in value_data.items():
        setattr(db_pr_value, key, value)

    session.add(db_pr_value)
    session.commit()
    session.refresh(db_pr_value)
    return PRValueRead.serialize(db_pr_value)


@app.delete("/api/pr/{pr_id}/value/{value_id}")
def delete_pr_value(
    pr_id: int,
    value_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_pr = session.get(PR, pr_id)
    verify_exists_and_owns(current_user, db_pr)

    db_pr_value = session.get(PRValue, value_id)
    if not db_pr_value:
        raise HTTPException(status_code=404, detail="PR Value not found")

    if db_pr_value.pr_id != pr_id:
        raise HTTPException(
            status_code=400, detail="PR Value does not belong to the specified PR"
        )

    session.delete(db_pr_value)
    session.commit()
    return {}


@app.post("/api/programs/upload")
async def upload_program(
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> ProgramRead:
    if file.content_type != "application/json":
        raise HTTPException(status_code=415, detail="File must be a JSON file")

    try:
        content = await file.read()
        data = json.loads(content)
        ProgramCreate(**data)  # Content format test
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except ValidationError as e:
        raise HTTPException(
            status_code=422, detail=f"File does not appear to be a Program"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    existing_program = session.exec(
        select(Program).where(
            Program.user == current_user, Program.name == data.get("name")
        )
    ).first()
    if existing_program:
        raise HTTPException(status_code=400, detail="Program already exists")

    new_program = Program(
        name=data.get("name"), description=data.get("description"), user=current_user
    )
    if data.get("image"):
        b64dcod_image = b64_decode(data.get("image"))
        if b64dcod_image.startswith(b"\x89PNG"):
            image_format = "png"
        elif b64dcod_image.startswith(b"\xff\xd8"):
            image_format = "jpeg"
        elif b64dcod_image.startswith(b"RIFF") and b64dcod_image[8:12] == b"WEBP":
            image_format = "webp"
        else:
            raise HTTPException(
                status_code=415,
                detail="Image format not supported. Allowed: PNG, JPG, WEBP",
            )

        random_filename = generate_filename(image_format)
        random_file = assets_folder_path() / random_filename
        save_image(b64dcod_image, random_file, (400, 400))

        image = Image(filename=random_filename, user=current_user)
        session.add(image)
        session.commit()
        session.refresh(image)
        new_program.image_id = image.id

    session.add(new_program)
    session.flush()

    blocs_category_id_mapping = {
        bloc.name: bloc.id
        for bloc in session.exec(
            select(BlocCategory).filter(BlocCategory.user == current_user)
        )
    }  # Prepare before the loops the mapping for {str: id}[]

    for step in data.get("steps", []):
        new_step = ProgramStep(
            name=step.get("name", None),
            repeat=step.get("repeat", 0),
            program_id=new_program.id,
            user=current_user,
        )
        session.add(new_step)
        session.flush()

        for bloc in step.get("blocs", []):
            bloc_category_id = blocs_category_id_mapping.get(bloc.get("type"))
            if bloc_category_id is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bloc type '{bloc.get('type')}' does not exist",
                )

            new_bloc = ProgramStepBloc(
                content=bloc.get("content"),
                program_step_id=new_step.id,
                duration=bloc.get("duration"),
                category_id=blocs_category_id_mapping.get(bloc.get("type")),
                next_in=bloc.get("next_in", 0),
                user=current_user,
            )
            session.add(new_bloc)

    session.commit()
    return ProgramRead.serialize(new_program)


@app.get("/api/programs/{program_id}/export")
def export_program(
    program_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
):
    db_program = session.exec(
        select(Program)
        .where(Program.id == program_id, Program.user == current_user)
        .options(selectinload(Program.steps))
    ).first()
    if not db_program:
        raise HTTPException(status_code=404, detail="Not found")

    data = db_program.dict()  # Use dict() instead of serialize to get a dict
    data["steps"] = [
        ProgramStepWithBlocsRead.serialize(step) for step in db_program.steps
    ]
    return data


@app.get("/api/programs", response_model=list[ProgramRead])
def read_programs(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> list[ProgramRead]:
    programs = session.exec(select(Program).filter(Program.user == current_user))
    return [ProgramRead.serialize(program) for program in programs]


@app.post("/api/programs", response_model=ProgramRead)
def create_program(
    program_data: ProgramCreate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramRead:
    new_program = Program(name=program_data.name, user=current_user)

    if program_data.image_id:
        db_img = session.get(Image, program_data.image_id)
        verify_exists_and_owns(current_user, db_img)
        new_program.image_id = db_img.id

    if program_data.image:
        b64dcod_image = b64_decode(program_data.image)
        if b64dcod_image.startswith(b"\x89PNG"):
            image_format = "png"
        elif b64dcod_image.startswith(b"\xff\xd8"):
            image_format = "jpeg"
        elif b64dcod_image.startswith(b"RIFF") and b64dcod_image[8:12] == b"WEBP":
            image_format = "webp"
        else:
            raise HTTPException(
                status_code=415,
                detail="Image format not supported. Allowed: PNG, JPG, WEBP",
            )

        random_filename = generate_filename(image_format)
        random_file = assets_folder_path() / random_filename
        save_image(b64dcod_image, random_file, (400, 400))

        image = Image(filename=random_filename, user=current_user)
        session.add(image)
        session.commit()
        session.refresh(image)
        new_program.image_id = image.id

    session.add(new_program)
    session.commit()
    session.refresh(new_program)
    return ProgramRead.serialize(new_program)


@app.put("/api/programs/{program_id}", response_model=ProgramRead)
def update_program(
    program_id: int,
    program: ProgramUpdate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramRead:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    program_data = program.model_dump(exclude_unset=True)
    remove_previous_image = False

    if (
        program_data.get("image_id") and program.image_id != db_program.image_id
    ):  # If image_id and image_id is different as the one in DB
        db_img = session.get(Image, program.image_id)
        verify_exists_and_owns(current_user, db_img)
        program_data.pop("image", None)  # Ensure consistency
        remove_previous_image = True

    if program_data.get("image"):
        b64dcod_image = b64_decode(program_data.get("image"))
        if b64dcod_image.startswith(b"\x89PNG"):
            image_format = "png"
        elif b64dcod_image.startswith(b"\xff\xd8"):
            image_format = "jpeg"
        elif b64dcod_image.startswith(b"RIFF") and b64dcod_image[8:12] == b"WEBP":
            image_format = "webp"
        else:
            raise HTTPException(
                status_code=415,
                detail="Image format not supported. Allowed: PNG, JPG, WEBP",
            )

        random_filename = generate_filename(image_format)
        random_file = assets_folder_path() / random_filename
        if not save_image(b64dcod_image, random_file, (400, 400)):
            # TODO: Enhanced logging
            raise HTTPException(
                status_code=400, detail="Image cannot be read, most likely corrupted"
            )

        image = Image(filename=random_filename, user=current_user)
        session.add(image)
        session.commit()
        session.refresh(image)

        remove_previous_image = True
        program_data.pop("image")
        program_data["image_id"] = image.id

    if remove_previous_image and db_program.image_id:
        old_image = session.get(Image, db_program.image_id)

        if old_image and len(old_image.programs) == 1:
            try:
                remove_image(old_image.filename)
                session.delete(old_image)
            except Exception as exc:
                print("Exception during previous image deletion:", exc)

    session.refresh(db_program)

    for key, value in program_data.items():
        setattr(db_program, key, value)

    session.add(db_program)
    session.commit()
    session.refresh(db_program)
    return ProgramRead.serialize(db_program)


@app.delete("/api/programs/{program_id}")
def delete_program(
    program_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    if db_program.image and len(db_program.image.programs) == 1:
        try:
            remove_image(db_program.image.filename)
            session.delete(db_program.image)
        except Exception as exc:
            # TODO: Enhanced logging
            print("Exception during image deletion:", exc)

    session.delete(db_program)
    session.commit()
    return {}


@app.get("/api/programs/{program_id}", response_model=ProgramReadComplete)
def read_program(
    program_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramReadComplete:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)
    return ProgramReadComplete.serialize(db_program)


@app.get("/api/programs/{program_id}/steps", response_model=list[ProgramStepWithBlocsRead])
def read_program_steps(
    program_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> list[ProgramStepWithBlocsRead]:
    steps = session.exec(
        select(ProgramStep).filter(
            ProgramStep.user == current_user, ProgramStep.program_id == program_id
        )
    )
    return [ProgramStepWithBlocsRead.serialize(step) for step in steps]


@app.post("/api/programs/{program_id}/steps", response_model=ProgramStepRead)
def create_program_step(
    program_id: int,
    step_data: ProgramStepCreate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramStepRead:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    new_step = ProgramStep(
        name=step_data.name,
        repeat=step_data.repeat,
        program_id=program_id,
        user=current_user,
    )
    session.add(new_step)
    session.commit()
    session.refresh(new_step)
    return ProgramStepRead.serialize(new_step)


@app.put("/api/programs/{program_id}/steps/{step_id}", response_model=ProgramStepRead)
def update_program_step(
    program_id: int,
    step_id: int,
    step_data: ProgramStepUpdate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramStepRead:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    db_program_step = session.get(ProgramStep, step_id)
    verify_exists_and_owns(current_user, db_program_step)

    if db_program_step.program_id != program_id:
        raise HTTPException(
            status_code=400, detail="Step does not belong to the specified Program"
        )

    step_data = step_data.model_dump(exclude_unset=True)
    for key, value in step_data.items():
        setattr(db_program_step, key, value)

    session.add(db_program_step)
    session.commit()
    session.refresh(db_program_step)
    return ProgramStepRead.serialize(db_program_step)


@app.delete("/api/programs/{program_id}/steps/{step_id}")
def delete_program_step(
    program_id: int,
    step_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    db_program_step = session.get(ProgramStep, step_id)
    verify_exists_and_owns(current_user, db_program_step)

    if db_program_step.program_id != program_id:
        raise HTTPException(
            status_code=400, detail="Step does not belong to the specified Program"
        )

    session.delete(db_program_step)
    session.commit()
    return {}


@app.post("/api/programs/{program_id}/steps/{step_id}/blocs", response_model=ProgramStepBlocRead)
def create_program_step_bloc(
    program_id: int,
    step_id: int,
    bloc_data: ProgramStepBlocCreate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramStepBlocRead:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    db_program_step = session.get(ProgramStep, step_id)
    verify_exists_and_owns(current_user, db_program_step)

    if db_program_step.program_id != program_id:
        raise HTTPException(
            status_code=400, detail="Step does not belong to the specified Program"
        )

    if not bloc_data.category and not bloc_data.category_id:
        raise HTTPException(status_code=400, detail="No Category provided")

    new_bloc = ProgramStepBloc(
        content=bloc_data.content,
        duration=bloc_data.duration,
        next_in=bloc_data.next_in,
        program_step_id=step_id,
        user=current_user,
    )

    # category_id prioritized
    if bloc_data.category_id:
        new_bloc.category_id = bloc_data.category_id

    # Else we retrieve category.id for bloc.category_id
    else:
        new_bloc.category_id = bloc_data.category.id

    session.add(new_bloc)
    session.commit()
    return ProgramStepBlocRead.serialize(new_bloc)


@app.put("/api/programs/{program_id}/steps/{step_id}/blocs/{bloc_id}",
    response_model=ProgramStepBlocRead,
)
def update_program_step_bloc(
    program_id: int,
    step_id: int,
    bloc_id: int,
    bloc_data: ProgramStepBlocUpdate,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> ProgramStepBlocRead:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    db_program_step = session.get(ProgramStep, step_id)
    verify_exists_and_owns(current_user, db_program_step)

    if db_program_step.program_id != program_id:
        raise HTTPException(
            status_code=400, detail="Step does not belong to the specified Program"
        )

    db_program_step_bloc = session.get(ProgramStepBloc, bloc_id)
    verify_exists_and_owns(current_user, db_program_step_bloc)

    if db_program_step_bloc.program_step_id != step_id:
        raise HTTPException(
            status_code=400, detail="Bloc does not belong to the specified Program Step"
        )

    bloc_data = bloc_data.model_dump(exclude_unset=True)
    if bloc_data.get("category"):
        bloc_data["category_id"] = bloc_data.get("category").get("id")
        bloc_data.pop("category")

    for key, value in bloc_data.items():
        setattr(db_program_step_bloc, key, value)

    session.add(db_program_step_bloc)
    session.commit()
    session.refresh(db_program_step_bloc)
    return ProgramStepBlocRead.serialize(db_program_step_bloc)


@app.delete("/api/programs/{program_id}/steps/{step_id}/blocs/{bloc_id}")
def delete_program_step_bloc(
    program_id: int,
    step_id: int,
    bloc_id: int,
    session: SessionDep,
    current_user: Annotated[str, Depends(get_current_user)],
) -> dict:
    db_program = session.get(Program, program_id)
    verify_exists_and_owns(current_user, db_program)

    db_program_step = session.get(ProgramStep, step_id)
    verify_exists_and_owns(current_user, db_program_step)

    if db_program_step.program_id != program_id:
        raise HTTPException(
            status_code=400, detail="Step does not belong to the specified Program"
        )

    db_program_step_bloc = session.get(ProgramStepBloc, bloc_id)
    verify_exists_and_owns(current_user, db_program_step_bloc)

    if db_program_step_bloc.program_step_id != step_id:
        raise HTTPException(
            status_code=400, detail="Bloc does not belong to the specified Program Step"
        )

    session.delete(db_program_step_bloc)
    session.commit()
    return {}


@app.post("/api/auth/login", response_model=Token)
def login(req: LoginRegisterModel, session: SessionDep) -> Token:
    user = session.get(User, req.username)
    exception = HTTPException(status_code=401, detail="Could not validate credentials")

    if not user:
        raise exception

    if not verify_password(req.password, user.password):
        raise exception

    return create_tokens(data={"sub": user.username})


@app.post("/api/auth/register", response_model=Token)
def register(req: LoginRegisterModel, session: SessionDep) -> Token:
    user = session.get(User, req.username)
    if user:
        raise HTTPException(status_code=409, detail="Username already exists")

    new_user = User(username=req.username, password=hash_password(req.password))
    session.add(new_user)
    session.commit()

    init_user_data(session, new_user.username)  # Init the user data

    return create_tokens(data={"sub": new_user.username})


@app.post("/api/auth/refresh")
def refresh_token(refresh_token: str = Body(..., embed=True)):
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token expected")

    try:
        payload = jwt.decode(
            refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        username = payload.get("sub", None)

        if username is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        new_access_token = create_access_token(data={"sub": username})

        return {"access_token": new_access_token}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@app.get("/api/settings", response_model=UserRead)
def read_user_settings(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> UserRead:
    user = session.get(User, current_user)
    return UserRead.serialize(user)


@app.get("/api/export")
def export_user_data(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
):
    data = {
        "_": {
            "at": datetime.timestamp(datetime.now()),
        },
        "categories": read_categories(session, current_user),
        "blocs": [
            BlocRead.serialize(bloc)
            for bloc in session.exec(select(Bloc).filter(Bloc.user == current_user))
        ],
        "images": {},
        "programs": [
            export_program(program.id, session, current_user)
            for program in session.exec(
                select(Program).filter(Program.user == current_user)
            )
        ],
    }

    images = session.exec(select(Image).where(Image.user == current_user))
    for im in images:
        with open(Path(settings.ASSETS_FOLDER) / im.filename, "rb") as f:
            data["images"][im.id] = base64.b64encode(f.read())

    return data


@app.get("/api/settings/checkversion")
def check_version(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
):
    return check_update()


@app.put("/api/settings/api_token")
def generate_user_api_token(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
) -> str:
    db_user = session.get(User, current_user)
    if db_user.api_token:
        raise HTTPException(status_code=400, detail="Token already init")

    token = generate_api_token()
    setattr(db_user, "api_token", token)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return token


@app.delete("/api/settings/api_token")
def delete_user_api_token(
    session: SessionDep, current_user: Annotated[str, Depends(get_current_user)]
):
    db_user = session.get(User, current_user)
    if not db_user.api_token:
        raise HTTPException(status_code=400, detail="No Token")

    setattr(db_user, "api_token", None)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return {}

app.mount("/", StaticFiles(directory=settings.FRONTEND_FOLDER, html=True), name="frontend")