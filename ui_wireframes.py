"""
UI Screens / Wireframes - Smart Surveillance System

How to run:
    1. Keep this file and ui_wireframe_viewer.html in the SAME folder.
    2. python ui_wireframes.py
    3. Browser opens. Choose "Color" (high-fidelity) or "Wireframe" (gray, low-fidelity),
       then click "Download PNG".
    4. Press Enter in the terminal -> next screen appears. (p = previous, q = quit)

Only the Python standard library is used.
To change a screen, edit SCREENS below (text, rows, numbers). The HTML file draws it.

Block types used inside rows:  stat, table, bars, cams, form, alerts, detail, timeline, chat, chips
Row format: each row is a list of blocks; "f" is the flex width of a block in that row.
"""
import json
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8001
HTML_FILE = Path(__file__).with_name("ui_wireframe_viewer.html")

NAV = ["Dashboard", "Live Monitoring", "Multi-Camera Tracking", "Alerts", "Chat Search", "Cameras", "Settings"]

SCREENS = [
    # ------------------------------------------------------------------ UI-01
    {"id": "UI-01", "name": "Login", "layout": "auth",
     "brand": ["Smart Surveillance System", "Real-time crime detection, suspect tracking and footage search."],
     "form": {"title": "Sign In", "subtitle": "Access the surveillance console",
              "fields": [{"label": "Email", "ph": "operator@example.com"},
                         {"label": "Password", "ph": "••••••••"}],
              "buttons": [{"text": "Sign In", "tone": "pri", "full": True}],
              "link": "Forgot password?", "note": "Authorized personnel only"}},

    # ------------------------------------------------------------------ UI-02
    {"id": "UI-02", "name": "Dashboard", "layout": "app", "nav": "Dashboard", "title": "Dashboard",
     "rows": [
         [{"t": "stat", "label": "Cameras Online", "value": "12 / 14", "sub": "2 offline", "tone": "warn"},
          {"t": "stat", "label": "Alerts Today", "value": "7", "sub": "3 not reviewed", "tone": "bad"},
          {"t": "stat", "label": "Suspects Tracked", "value": "2", "sub": "Across 4 cameras", "tone": "acc"},
          {"t": "stat", "label": "Avg. Alert Latency", "value": "1.2 s", "sub": "Last 24 hours", "tone": "ok"}],
         [{"t": "bars", "f": 2, "title": "Detected Activities (Today)",
           "data": [["Fighting", 3], ["Mobile Snatching", 2], ["Robbery", 1], ["Assault", 1]]},
          {"t": "table", "f": 3, "title": "Recent Alerts",
           "cols": ["Time", "Camera", "Activity", "Severity", "Status"],
           "rows": [["14:08", "CAM-01", "Fighting", "bad|High", "warn|Pending"],
                    ["13:52", "CAM-03", "Mobile Snatching", "bad|High", "ok|Reviewed"],
                    ["12:31", "CAM-02", "Robbery", "warn|Medium", "ok|Reviewed"],
                    ["11:05", "CAM-05", "Assault", "warn|Medium", "warn|Pending"]]}]]},

    # ------------------------------------------------------------------ UI-03
    {"id": "UI-03", "name": "Live Monitoring", "layout": "app", "nav": "Live Monitoring", "title": "Live Monitoring",
     "rows": [[
         {"t": "cams", "f": 3, "title": "Live Feeds", "cols": 2, "h": 230, "cams": [
             {"name": "CAM-01 · Entrance", "tags": [{"label": "Fighting 91%", "box": [30, 30, 38, 58], "tone": "bad"}]},
             {"name": "CAM-02 · Corridor", "tags": [{"label": "Person", "box": [42, 28, 20, 62], "tone": "acc"}]},
             {"name": "CAM-03 · Parking", "tags": []},
             {"name": "CAM-04 · Lobby", "offline": True}]},
         {"t": "alerts", "f": 1, "title": "Live Detections", "sel": 0, "items": [
             {"sev": "bad", "title": "Fighting · 91%", "meta": "CAM-01 · 14:08:32"},
             {"sev": "warn", "title": "Suspicious Loitering · 74%", "meta": "CAM-03 · 14:02:10"},
             {"sev": "ok", "title": "No activity", "meta": "CAM-02 · 14:00:00"}]}]]},

    # ------------------------------------------------------------------ UI-04
    {"id": "UI-04", "name": "Camera Management", "layout": "app", "nav": "Cameras", "title": "Camera Management",
     "rows": [[
         {"t": "table", "f": 2, "title": "Registered Cameras", "btn": "+ Add Camera",
          "cols": ["Name", "Zone", "Stream URL", "Status", "Actions"],
          "rows": [["CAM-01", "Entrance", "rtsp://192.168.1.11/s1", "ok|Online", "Edit · Remove"],
                   ["CAM-02", "Corridor", "rtsp://192.168.1.12/s1", "ok|Online", "Edit · Remove"],
                   ["CAM-03", "Parking", "rtsp://192.168.1.13/s1", "ok|Online", "Edit · Remove"],
                   ["CAM-04", "Lobby", "rtsp://192.168.1.14/s1", "bad|Offline", "Edit · Remove"],
                   ["CAM-05", "Gate", "rtsp://192.168.1.15/s1", "ok|Online", "Edit · Remove"]]},
         {"t": "form", "f": 1, "title": "Add / Edit Camera",
          "fields": [{"label": "Camera Name", "ph": "e.g. CAM-06"},
                     {"label": "Zone / Location", "ph": "Select zone", "type": "select"},
                     {"label": "RTSP Stream URL", "ph": "rtsp://"}],
          "buttons": [{"text": "Test Connection", "tone": "sec"}, {"text": "Save", "tone": "pri"}]}]]},

    # ------------------------------------------------------------------ UI-05
    {"id": "UI-05", "name": "Alerts", "layout": "app", "nav": "Alerts", "title": "Alerts",
     "rows": [[
         {"t": "table", "title": "All Alerts", "btn": "Filter ▾",
          "cols": ["Alert ID", "Time", "Camera", "Activity", "Confidence", "Severity", "Status"],
          "rows": [["ALT-0231", "14:08:32", "CAM-01", "Fighting", "91%", "bad|High", "warn|Pending"],
                   ["ALT-0230", "13:52:07", "CAM-03", "Mobile Snatching", "86%", "bad|High", "ok|Acknowledged"],
                   ["ALT-0229", "12:31:44", "CAM-02", "Robbery", "79%", "warn|Medium", "ok|Acknowledged"],
                   ["ALT-0228", "11:49:20", "CAM-04", "Kidnapping", "72%", "bad|High", "bad|Escalated"],
                   ["ALT-0227", "11:05:02", "CAM-05", "Assault", "70%", "warn|Medium", "warn|Pending"],
                   ["ALT-0226", "10:17:55", "CAM-03", "Fighting", "68%", "warn|Medium", "info|False Positive"]]}]]},

    # ------------------------------------------------------------------ UI-06
    {"id": "UI-06", "name": "Alert Details & Flag Suspect", "layout": "app", "nav": "Alerts", "title": "Alert Details",
     "rows": [[
         {"t": "cams", "f": 2, "title": "Snapshot", "cols": 1, "h": 400, "cams": [
             {"name": "CAM-01 · Entrance", "snap": "14:08:32",
              "tags": [{"label": "Fighting 91%", "box": [28, 22, 40, 62], "tone": "bad"}]}]},
         {"t": "detail", "f": 1, "title": "ALT-0231",
          "fields": [["Activity", "Fighting"], ["Confidence", "91%"], ["Severity", "High"],
                     ["Camera", "CAM-01 (Entrance)"], ["Time", "14:08:32"], ["Status", "Pending"]],
          "buttons": [{"text": "Acknowledge", "tone": "pri", "full": True},
                      {"text": "Mark as False Positive", "tone": "sec", "full": True},
                      {"text": "Flag Suspect", "tone": "bad", "full": True}]}]]},

    # ------------------------------------------------------------------ UI-07
    {"id": "UI-07", "name": "Multi-Camera Tracking", "layout": "app", "nav": "Multi-Camera Tracking",
     "title": "Multi-Camera Tracking",
     "rows": [
         [{"t": "cams", "title": "Synchronised Feeds", "cols": 4, "h": 170, "cams": [
             {"name": "CAM-01 · Entrance", "tags": [{"label": "SUSP-07", "box": [35, 28, 26, 62], "tone": "warn"}]},
             {"name": "CAM-02 · Corridor", "tags": [{"label": "SUSP-07", "box": [48, 30, 24, 60], "tone": "warn"}]},
             {"name": "CAM-03 · Parking", "tags": []},
             {"name": "CAM-05 · Gate", "tags": []}]}],
         [{"t": "timeline", "f": 2, "title": "SUSP-07 · Identity Hand-off Timeline", "steps": [
             {"cam": "CAM-01", "time": "14:08", "note": "Flagged"},
             {"cam": "CAM-02", "time": "14:10", "note": "Re-identified (0.91)"},
             {"cam": "CAM-05", "time": "14:13", "note": "Re-identified (0.87)"},
             {"cam": "CAM-03", "time": "--", "note": "Searching"}]},
          {"t": "form", "f": 1, "title": "Tracking Controls",
           "fields": [{"label": "Stitched view (overlapping cameras)", "type": "toggle", "on": False},
                      {"label": "Show ID overlay on all feeds", "type": "toggle", "on": True}],
           "buttons": [{"text": "Stop Tracking", "tone": "bad"}]}]]},

    # ------------------------------------------------------------------ UI-08
    {"id": "UI-08", "name": "Chat Search", "layout": "app", "nav": "Chat Search", "title": "Chat-Based Retrieval",
     "rows": [[
         {"t": "chat", "f": 3, "placeholder": "Ask about events or footage…", "messages": [
             {"from": "user", "text": "Show all fights in the parking area yesterday"},
             {"from": "bot", "text": "I found 2 fighting events in the parking area yesterday.",
              "clips": [{"cam": "CAM-03", "time": "18:42", "label": "Fighting 88%"},
                        {"cam": "CAM-03", "time": "21:15", "label": "Fighting 81%"}]},
             {"from": "user", "text": "Where was SUSP-07 last seen?"},
             {"from": "bot", "text": "SUSP-07 was last seen at CAM-05 (Gate) at 14:13, after leaving CAM-02.",
              "clips": [{"cam": "CAM-05", "time": "14:13", "label": "SUSP-07"}]}]},
         {"t": "chips", "f": 1, "title": "Try asking", "items": [
             "Show robberies from last week", "Any snatching near the gate today?",
             "Summarise today's alerts", "Show SUSP-07 across all cameras"]}]]},

    # ------------------------------------------------------------------ UI-09
    {"id": "UI-09", "name": "Settings (Alert Rules)", "layout": "app", "nav": "Settings", "title": "Settings",
     "rows": [[
         {"t": "form", "f": 1, "title": "Alert Rules",
          "fields": [{"label": "Confidence Threshold", "type": "slider", "value": 70, "text": "0.70"},
                     {"label": "Minimum Severity", "type": "select", "ph": "Medium"},
                     {"label": "Fighting", "type": "toggle", "on": True},
                     {"label": "Robbery", "type": "toggle", "on": True},
                     {"label": "Kidnapping", "type": "toggle", "on": True},
                     {"label": "Mobile Snatching", "type": "toggle", "on": True}],
          "buttons": [{"text": "Save Changes", "tone": "pri"}]},
         {"t": "form", "f": 1, "title": "Notifications",
          "fields": [{"label": "Push notifications (FCM)", "type": "toggle", "on": True},
                     {"label": "Show alerts on dashboard", "type": "toggle", "on": True},
                     {"label": "Escalate unacknowledged alerts after", "type": "select", "ph": "5 minutes"},
                     {"label": "Escalate to", "type": "select", "ph": "Control Room"}],
          "buttons": [{"text": "Save Changes", "tone": "pri"}]}]]},
]

# ----------------------------------------------------------------------------
state = {"i": 0}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/current":
            payload = {"index": state["i"], "total": len(SCREENS), "screen": SCREENS[state["i"]], "nav": NAV}
            body, ctype = json.dumps(payload).encode("utf-8"), "application/json"
        elif path in ("/", "/index.html"):
            body, ctype = HTML_FILE.read_bytes(), "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def show(i):
    s = SCREENS[i]
    print(f"\n[{i + 1}/{len(SCREENS)}] {s['id']}: {s['name']}  -> shown in browser")


def main():
    if not HTML_FILE.exists():
        sys.exit(f"Missing {HTML_FILE.name}. Put it in the same folder as this script.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{PORT}"
    webbrowser.open(url)
    print(f"Open {url} if the browser did not start.")
    show(0)
    while True:
        cmd = input("Download PNG(s), then press Enter for NEXT (p = previous, q = quit): ").strip().lower()
        if cmd == "q":
            break
        if cmd == "p":
            state["i"] = max(0, state["i"] - 1)
        else:
            if state["i"] == len(SCREENS) - 1:
                print(f"All {len(SCREENS)} screens are done. Type q to quit.")
                continue
            state["i"] += 1
        show(state["i"])
    server.shutdown()


if __name__ == "__main__":
    main()
