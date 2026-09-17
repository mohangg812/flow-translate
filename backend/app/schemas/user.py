import uuid
import re
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator


class UserRegister(BaseModel):
    email: EmailStr = Field(..., description="Электронная почта")
    password: str = Field(..., min_length=6, max_length=64, description="Пароль (минимум 6 символов)")
    password_confirm: str = Field(..., description="Повтор пароля")

    @model_validator(mode="after")
    def validate_password_match_and_complexity(self):
        if self.password != self.password_confirm:
            raise ValueError("Пароли не совпадают")
        if len(self.password) < 6:
            raise ValueError("Пароль должен содержать не менее 6 символов")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class VerifyCodeRequest(BaseModel):
    email: EmailStr = Field(..., description="Email пользователя")
    code: str = Field(..., min_length=6, max_length=6, description="6-значный код подтверждения")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    role: str
    is_active: bool
    is_verified: bool
    theme_preference: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ThemeUpdate(BaseModel):
    theme: str = Field(..., pattern="^(light|dark)$", description="Тема оформления (light или dark)")


class PasswordChange(BaseModel):
    old_password: str = Field(..., description="Старый пароль")
    new_password: str = Field(..., min_length=8, max_length=64, description="Новый пароль")
    new_password_confirm: str = Field(..., description="Повтор нового пароля")

    @model_validator(mode="after")
    def validate_match(self):
        if self.new_password != self.new_password_confirm:
            raise ValueError("Новые пароли не совпадают")
        if not re.search(r"\d", self.new_password):
            raise ValueError("Новый пароль должен содержать хотя бы одну цифру")
        if not re.search(r"[A-Z]", self.new_password):
            raise ValueError("Новый пароль должен содержать хотя бы одну заглавную букву")
        return self