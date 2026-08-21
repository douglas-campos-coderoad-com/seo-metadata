from sqlalchemy import Column, Integer, String, Text
from src.models import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = 'projects'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    # The site this project tracks; pre-fills the project's "analyze a URL" input.
    url = Column(String(2048), nullable=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)
    country = Column(String(100), nullable=False)
    region = Column(String(100), nullable=True)
