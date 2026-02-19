import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# 프로젝트 루트를 sys.path에 추가 (app 모듈 import를 위해)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.models.base import Base
# 모든 모델을 import해야 Base.metadata에 테이블이 등록됨
from app.models import (
    Item, ItemCategory,
    Inventory,
    Transaction, TransactionType,
    Supplier,
    Order, OrderItem, OrderStatus,
    PushToken,
    Menu, RecipeItem,
    Sale,
    Staff,
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# env.py에서 동적으로 DB URL 설정 (alembic.ini의 sqlalchemy.url 대신 사용)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 앱의 Base.metadata를 사용 (autogenerate 지원)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite ALTER TABLE 지원
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite ALTER TABLE 지원
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
