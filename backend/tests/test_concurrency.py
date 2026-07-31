import unittest

from app.main import write_lock_for, write_locks


class WriteLockTests(unittest.TestCase):
    def test_tasks_for_the_same_project_share_one_write_lock(self) -> None:
        write_locks.clear()
        self.assertIs(write_lock_for("/project"), write_lock_for("/project"))
        self.assertIsNot(write_lock_for("/project"), write_lock_for("/other-project"))
