MAX_RETRIES = 4


def can_retry(completed_retries):
    return completed_retries < MAX_RETRIES


def test_retry_limit():
    assert can_retry(3)
    assert not can_retry(4)
