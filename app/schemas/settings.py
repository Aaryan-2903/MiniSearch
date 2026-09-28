from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SearchMode(str, Enum):
    ANY = "any"
    ALL = "all"


class SettingsOut(BaseModel):
    case_sensitive: bool
    stop_words_enabled: bool
    default_search_mode: str
    max_file_size_mb: int
    ranking_algorithm: str = "TF-IDF"
    accepted_file_types: List[str] = [".txt"]
    rebuild_required: bool


class SettingsUpdate(BaseModel):
    case_sensitive: Optional[bool] = None
    stop_words_enabled: Optional[bool] = None
    default_search_mode: Optional[SearchMode] = None
    max_file_size_mb: Optional[int] = Field(default=None, ge=1, le=50)

    model_config = {
        "extra": "forbid"
    }
