from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from src.models import Base, TimestampMixin


class Competitor(Base, TimestampMixin):
    __tablename__ = 'competitors'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey('projects.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    url = Column(String(2048), nullable=False)
    description = Column(Text, nullable=False)

    project = relationship('Project', backref='competitors')
