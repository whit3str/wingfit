import re
import secrets
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, Union

from pydantic import BaseModel
from pydantic_settings import BaseSettings
from sqlmodel import JSON, Field, Relationship, Session, SQLModel, create_engine, select


class Settings(BaseSettings):
    ASSETS_FOLDER: str = "storage/assets"
    FRONTEND_FOLDER: str = "frontend"
    SQLITE_FILE: str = "storage/wingfit.sqlite"
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440

    class Config:
        env_file = "storage/config.yml"


class ResultKeyEnum(str, Enum):
    KG = "kg"
    REP = "rep"
    TIME = "time"


class LoginRegisterModel(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str


class TokenData(BaseModel):
    username: str | None = None


class ImageBase(SQLModel):
    filename: str


class Image(ImageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")
    programs: list["Program"] | None = Relationship(back_populates="image")


class UserBase(SQLModel): ...


class User(UserBase, table=True):
    username: str = Field(primary_key=True)
    password: str
    last_connect: datetime = Field(default_factory=datetime.utcnow)
    api_token: str | None = None


class UserRead(UserBase):
    username: str
    last_connect: datetime
    api_token: bool = False

    @classmethod
    def serialize(cls, obj: User) -> "UserRead":
        return cls(
            username=obj.username,
            last_connect=obj.last_connect,
            api_token=True if obj.api_token else False,
        )


class StashBase(SQLModel):
    content: str


class Stash(StashBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cdate: date = Field(default_factory=lambda: datetime.utcnow().date())
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")


class StashRead(StashBase):
    id: int
    content: str
    cdate: date

    @classmethod
    def serialize(cls, obj: Stash) -> "StashRead":
        return cls(
            id=obj.id,
            content=obj.content,
            cdate=obj.cdate,
        )


class BlocCategoryBase(SQLModel):
    name: str
    color: str | None = None
    weight: int | None = None


class BlocCategory(BlocCategoryBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")
    blocs: list["Bloc"] = Relationship(back_populates="category")
    programblocs: list["ProgramStepBloc"] = Relationship(back_populates="category")


class BlocCategoryRead(SQLModel):
    id: int
    name: str
    color: str | None = None
    weight: int | None = None

    @classmethod
    def serialize(cls, obj: BlocCategory) -> "BlocCategoryRead":
        return cls(
            id=obj.id,
            name=obj.name,
            color=obj.color,
            weight=obj.weight,
        )


class BlocResultBase(SQLModel):
    value: str
    comment: str | None = None
    key: ResultKeyEnum


class BlocResult(BlocResultBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    bloc: "Bloc" = Relationship(back_populates="result")


class BlocResultRead(BlocResultBase):
    ...

    @classmethod
    def serialize(cls, obj: BlocResult) -> "BlocResultRead":
        return cls(id=obj.id, value=obj.value, comment=obj.comment, key=obj.key)


class BlocBase(SQLModel):
    content: str
    duration: int | None = None


class Bloc(BlocBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cdate: date = Field(default_factory=lambda: datetime.utcnow().date())
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")
    # TODO: Programmation icon brand_id: int | None = Field(default=None, foreign_key="blocbrand.id")

    result_id: int | None = Field(default=None, foreign_key="blocresult.id")
    result: BlocResult | None = Relationship(back_populates="bloc")

    category_id: int = Field(foreign_key="bloccategory.id", ondelete="CASCADE")
    category: BlocCategory | None = Relationship(back_populates="blocs")


class BlocCreate(BlocBase):
    # TODO: Programmation icon
    category: BlocCategoryRead | None = None
    category_id: int | None = None
    cdate: str | date = Field(default_factory=lambda: datetime.utcnow().date())


class BlocUpdate(BlocBase):
    # TODO: Programmation icon
    content: str | None = None
    category: BlocCategoryRead | None = None
    category_id: int | None = None
    result_id: int | None = None
    cdate: str | date = Field(default_factory=lambda: datetime.utcnow().date())


class BlocRead(BlocBase):
    id: int | None
    cdate: date
    category: BlocCategoryRead
    result: BlocResultRead | None

    @classmethod
    def serialize(cls, obj: Bloc) -> "BlocRead":
        return cls(
            id=obj.id,
            duration=obj.duration,
            content=obj.content,
            cdate=obj.cdate,
            category=BlocCategoryRead.serialize(obj.category),
            result=BlocResultRead.serialize(obj.result) if obj.result else None,
        )


class PRBase(SQLModel):
    name: str
    key: ResultKeyEnum


class PR(PRBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    values: list["PRValue"] = Relationship(back_populates="pr", cascade_delete=True)
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")


class PRCreate(PRBase):
    values: list["PRValueCreateOrUpdate"] | None = None
    name: str | None = None
    key: ResultKeyEnum | None = None


class PRUpdate(PRBase):
    name: str | None = None
    key: ResultKeyEnum | None = None


class PRRead(PRBase):
    id: int | None = Field(default=None, primary_key=True)
    values: list["PRValueRead"]

    @classmethod
    def serialize(cls, obj: PR) -> "PRRead":
        return cls(
            id=obj.id,
            name=obj.name,
            key=obj.key,
            values=[PRValueRead.serialize(value) for value in obj.values],
        )


class PRValueBase(SQLModel):
    value: str


class PRValueCreateOrUpdate(PRValueBase):
    cdate: str | date = Field(default_factory=lambda: datetime.utcnow().date())

    @classmethod
    def value_matches_record_key(cls, key: ResultKeyEnum, value: str) -> bool:
        if key == "kg" or key == "rep":  # kg or rep must be a positive integer
            return value.isdigit() and int(value) > 0

        if key == "time":  # time must be "[hh:]mm:ss"
            return bool(
                re.fullmatch(r"^(?:(?:(\d{,3}):)?([0-5]?\d):)?([0-5]?\d)$", value)
            )

        return False


class PRValue(PRValueBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cdate: date = Field(default_factory=lambda: datetime.utcnow().date())

    pr_id: int = Field(foreign_key="pr.id")
    pr: PR | None = Relationship(back_populates="values")


class PRValueRead(PRValueBase):
    id: int
    cdate: date

    @classmethod
    def serialize(cls, obj: PR) -> "PRValueRead":
        return cls(
            id=obj.id,
            cdate=obj.cdate,
            value=obj.value,
        )


class ProgramBase(SQLModel):
    name: str
    description: str | None = None


class Program(ProgramBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cdate: date = Field(default_factory=lambda: datetime.utcnow().date())
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")
    image_id: int | None = Field(
        default=None, foreign_key="image.id", ondelete="CASCADE"
    )
    image: Image | None = Relationship(back_populates="programs")
    steps: list["ProgramStep"] = Relationship(
        back_populates="program", cascade_delete=True
    )


class ProgramCreate(ProgramBase):
    image: str | None = None
    image_id: int | None = None


class ProgramUpdate(ProgramBase):
    name: str | None = None
    image: str | None = None
    image_id: int | None = None


class ProgramRead(ProgramBase):
    id: int
    image_id: int | None
    image: str | None
    steps: list["ProgramStepRead"]
    cdate: date

    @classmethod
    def serialize(cls, obj: Program) -> "ProgramRead":
        return cls(
            id=obj.id,
            name=obj.name,
            description=obj.description,
            cdate=obj.cdate,
            image_id=obj.image_id,
            image=obj.image.filename if obj.image else None,
            steps=[ProgramStepRead.serialize(step) for step in obj.steps],
        )


class ProgramReadComplete(ProgramRead):
    steps: list["ProgramStepWithBlocsRead"]

    @classmethod
    def serialize(cls, obj: Program) -> "ProgramRead":
        return cls(
            id=obj.id,
            name=obj.name,
            description=obj.description,
            cdate=obj.cdate,
            image_id=obj.image_id,
            image=obj.image.filename if obj.image else None,
            steps=[ProgramStepWithBlocsRead.serialize(step) for step in obj.steps],
        )


class ProgramStepBase(SQLModel):
    name: str
    repeat: int = 0
    next_in: int = 1


class ProgramStep(ProgramStepBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cdate: date = Field(default_factory=lambda: datetime.utcnow().date())
    user: str = Field(foreign_key="user.username", ondelete="CASCADE")
    program_id: int = Field(foreign_key="program.id")
    program: Program | None = Relationship(back_populates="steps")

    blocs: list["ProgramStepBloc"] = Relationship(
        back_populates="program_steps", cascade_delete=True
    )


class ProgramStepUpdate(ProgramStepBase):
    name: str | None = None
    repeat: int | None = None
    next_in: int | None = None


class ProgramStepCreate(ProgramStepBase): ...


class ProgramStepWithBlocsRead(ProgramStepBase):
    id: int
    cdate: date
    blocs: list["ProgramStepBlocRead"]

    @classmethod
    def serialize(cls, obj: ProgramStep) -> "ProgramStepWithBlocsRead":
        return cls(
            id=obj.id,
            name=obj.name,
            cdate=obj.cdate,
            repeat=obj.repeat,
            blocs=[ProgramStepBlocRead.serialize(bloc) for bloc in obj.blocs],
        )


class ProgramStepRead(ProgramStepBase):
    id: int
    cdate: date
    blocs: list = []

    @classmethod
    def serialize(cls, obj: ProgramStep) -> "ProgramStepRead":
        return cls(
            id=obj.id, name=obj.name, cdate=obj.cdate, repeat=obj.repeat, blocs=[]
        )


class ProgramStepBlocBase(SQLModel):
    content: str
    duration: int | None = None


class ProgramStepBloc(ProgramStepBlocBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    next_in: int
    user: str = Field(foreign_key="user.username")

    category_id: int = Field(foreign_key="bloccategory.id", ondelete="CASCADE")
    category: BlocCategory | None = Relationship(back_populates="programblocs")

    program_step_id: int | None = Field(
        default=None, foreign_key="programstep.id", ondelete="CASCADE"
    )
    program_steps: ProgramStep | None = Relationship(back_populates="blocs")


class ProgramStepBlocCreate(ProgramStepBlocBase):
    category: BlocCategoryRead | None = None
    category_id: int | None = None
    next_in: int = 1


class ProgramStepBlocUpdate(ProgramStepBlocBase):
    category: BlocCategoryRead | None = None
    category_id: int | None = None
    content: str | None = None
    next_in: int | None = None


class ProgramStepBlocRead(ProgramStepBlocBase):
    id: int
    next_in: int
    category: BlocCategoryRead

    @classmethod
    def serialize(cls, obj: ProgramStepBloc) -> "ProgramStepBlocRead":
        return cls(
            id=obj.id,
            content=obj.content,
            duration=obj.duration,
            category=BlocCategoryRead.serialize(obj.category),
            next_in=obj.next_in,
        )


class TemplateBase(SQLModel):
    content: str
    duration: int | None = None


class Template(TemplateBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="bloccategory.id")
    user: str = Field(foreign_key="user.username")


class TemplateRead(TemplateBase):
    id: int
    category_id: int

    @classmethod
    def serialize(cls, obj: Template) -> "TemplateRead":
        return cls(
            id=obj.id,
            content=obj.content,
            duration=obj.duration,
            category_id=obj.category_id,
        )
