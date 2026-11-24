from abc import ABC, abstractmethod
from typing import Any

class BaseMonitor(ABC):
    @abstractmethod
    def start(self) -> bool:
        pass

    @abstractmethod
    def stop(self) -> None:
        pass

    @abstractmethod
    def get_state(self) -> Any:
        pass
