from machine import Pin
import time
import ujson

# ==========================================
# SMART BOOKMARK V2
# Raspberry Pi Pico W
# Button: GP15 (physical pin 20)
# ==========================================

button = Pin(15, Pin.IN, Pin.PULL_UP)

# BUTTON SETTINGS
DEBOUNCE_MS = 50
CLICK_WINDOW_MS = 450
PAUSE_HOLD_MS = 1500

# READING SETTINGS
START_PAGE = 1

# SESSION STATE
current_page = START_PAGE
session_active = True
paused = False

session_start = time.ticks_ms()
active_start = session_start
page_start = session_start
pause_start = None

total_active_ms = 0
total_paused_ms = 0
page_active_ms = 0

# READING ANALYTICS
forward_turns = 0
backward_turns = 0
total_visits = 0
page_visits = {}
page_history = []

# BUTTON STATE
last_raw = button.value()
stable_state = last_raw
last_change = time.ticks_ms()

press_start = None
click_count = 0
click_deadline = None

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def elapsed(start):
    return time.ticks_diff(time.ticks_ms(), start)


def send_event(event, data=None):

    message = {
        "event": event,
        "page": current_page,
        "paused": paused,
        "elapsed_seconds": round(elapsed(session_start) / 1000, 1),
        "active_reading_seconds": round(total_active_ms / 1000, 1),
        "paused_seconds": round(total_paused_ms / 1000, 1)
    }

    if data:
        message.update(data)

    print(ujson.dumps(message))


def record_page_visit(reason):

    global page_active_ms
    global total_visits

    duration = page_active_ms

    if not paused:
        duration += elapsed(page_start)

    total_visits += 1

    page_key = str(current_page)

    page_visits[page_key] = (
        page_visits.get(page_key, 0) + 1
    )

    visit = {
        "page": current_page,
        "visit_number": page_visits[page_key],
        "time_on_page_seconds": round(duration / 1000, 1),
        "navigation_reason": reason
    }

    page_history.append(visit)

    send_event("page_completed", {
        "completed_page": current_page,
        "visit_number": page_visits[page_key],
        "time_on_page_seconds": visit["time_on_page_seconds"],
        "navigation_reason": reason,
        "total_visits": total_visits,
        "unique_pages_visited": len(page_visits),
        "revisit_count": total_visits - len(page_visits)
    })


# ==========================================
# PAGE NAVIGATION
# ==========================================

def change_page(direction):

    global current_page
    global page_start
    global page_active_ms
    global forward_turns
    global backward_turns

    if paused or not session_active:
        return

    if direction == "back" and current_page <= 1:

        send_event("navigation_limit", {
            "message": "Already at page 1"
        })

        return

    record_page_visit(direction)

    if direction == "next":
        current_page += 1
        forward_turns += 1

    else:
        current_page -= 1
        backward_turns += 1

    page_start = time.ticks_ms()
    page_active_ms = 0

    send_event("page_started", {
        "new_page": current_page,
        "direction": direction,
        "forward_turns": forward_turns,
        "backward_turns": backward_turns,
        "unique_pages_visited": len(page_visits),
        "total_page_visits": total_visits
    })


# ==========================================
# PAUSE / RESUME
# ==========================================

def toggle_pause():

    global paused
    global page_active_ms
    global page_start
    global total_active_ms
    global active_start
    global pause_start
    global total_paused_ms

    now = time.ticks_ms()

    if not paused:

        # Stop active timers
        page_active_ms += time.ticks_diff(now, page_start)
        total_active_ms += time.ticks_diff(now, active_start)

        paused = True
        pause_start = now

        send_event("reading_paused", {
            "current_page": current_page
        })

    else:

        # Record time spent paused
        pause_duration = time.ticks_diff(now, pause_start)
        total_paused_ms += pause_duration

        paused = False

        # Restart active timers
        page_start = now
        active_start = now

        send_event("reading_resumed", {
            "current_page": current_page,
            "last_pause_seconds": round(pause_duration / 1000, 1),
            "total_paused_seconds": round(total_paused_ms / 1000, 1)
        })


# ==========================================
# END SESSION - TRIPLE CLICK
# ==========================================

def end_session():

    global session_active
    global total_active_ms
    global page_active_ms
    global total_paused_ms

    now = time.ticks_ms()

    if not paused:

        page_active_ms += time.ticks_diff(now, page_start)
        total_active_ms += time.ticks_diff(now, active_start)

    else:

        # Include the current pause in the summary
        total_paused_ms += time.ticks_diff(now, pause_start)

    record_page_visit("session_end")

    session_active = False

    active_seconds = total_active_ms / 1000
    total_seconds = time.ticks_diff(now, session_start) / 1000

    pace = 0

    if active_seconds > 0:
        pace = round(
            forward_turns / (active_seconds / 60), 2
        )

    send_event("reading_ended", {

        "last_page": current_page,

        "total_active_seconds": round(active_seconds, 1),

        "total_session_seconds": round(total_seconds, 1),

        "total_paused_seconds": round(total_paused_ms / 1000, 1),

        "forward_turns": forward_turns,

        "backward_turns": backward_turns,

        "unique_pages_visited": len(page_visits),

        "total_page_visits": total_visits,

        "revisit_count": total_visits - len(page_visits),

        "forward_turns_per_minute": pace,

        "page_visit_history": page_history

    })


# ==========================================
# CLICK PROCESSING
# ==========================================

def process_clicks(count):

    if count == 1:

        change_page("next")

    elif count == 2:

        change_page("back")


# ==========================================
# START SESSION
# ==========================================

print("SMART BOOKMARK V2 READY")
print("Single click: Next page")
print("Double click: Previous page")
print("Triple click: End session")
print("Hold 1.5 seconds: Pause / Resume")

send_event("reading_started", {
    "start_page": current_page,
    "firmware_version": "2.0"
})


# ==========================================
# MAIN LOOP
# ==========================================

while session_active:

    now = time.ticks_ms()
    raw = button.value()

    # Detect raw button changes
    if raw != last_raw:

        last_raw = raw
        last_change = now

    # Debounce button
    if elapsed(last_change) >= DEBOUNCE_MS:

        if raw != stable_state:

            stable_state = raw

            # BUTTON PRESSED
            if stable_state == 0:

                press_start = now

            # BUTTON RELEASED
            elif stable_state == 1 and press_start is not None:

                duration = time.ticks_diff(now, press_start)

                # Long press = Pause / Resume
                if duration >= PAUSE_HOLD_MS:

                    if click_count > 0:
                        process_clicks(click_count)
                        click_count = 0
                        click_deadline = None

                    toggle_pause()

                else:

                    # Short press: wait for more clicks
                    click_count += 1

                    if click_count == 3:

                        click_count = 0
                        click_deadline = None

                        end_session()

                    else:

                        click_deadline = time.ticks_add(
                            now, CLICK_WINDOW_MS
                        )

                press_start = None

    # Process single or double click after waiting
    if click_count > 0 and click_deadline is not None:

        if time.ticks_diff(now, click_deadline) >= 0:

            process_clicks(click_count)

            click_count = 0
            click_deadline = None

    time.sleep(0.01)


print("SMART BOOKMARK V2 SESSION CLOSED")
