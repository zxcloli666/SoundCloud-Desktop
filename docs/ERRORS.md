# Errors and what to do about them

[Русская версия](ERRORS.ru.md)

The number in brackets in a notification is the server response code. Mention it when you ask for help.

## The whole service is down

When no host answers, the app shows an "All hosts are down" window and a banner at the top. This is an outage on our side and we are already fixing it. Downloaded tracks keep playing from the offline library, and "Check again" re-tests the connection. Outage news is posted on [Discord](https://discord.gg/xQcGBP8fGG).

## Error codes

| Code | Meaning | What to do |
|---|---|---|
| 404 | The track, playlist or user was not found. Usually the author deleted or hid it on SoundCloud. | Check the link or look for another upload of the track. |
| 403 | Access denied: SoundCloud does not allow this action for your account, or the author restricted it. | Retrying will not help. If it is your own playlist, sign in again. |
| 409 | The action was not completed because the data changed in the meantime. If the text says "SoundCloud connection has expired", you need to sign in again. | Refresh the page and retry. For an expired connection, sign out and sign in again. |
| 429 | Too many requests. | Wait as long as the notification says and try again. |
| 500 | Internal server error. | Try again in a minute. If it keeps happening, report it on Discord and attach the log. |
| 502, 503 | The server or SoundCloud is temporarily unavailable. Often a short hiccup on the SoundCloud side. | Wait a minute and try again. |
| 504 | The server or SoundCloud did not answer in time. | Try again. |

Codes 228 and 1337 do not exist, they are a chat joke.

## "SoundCloud refused the request"

SoundCloud temporarily blocked a request from our server. Wait a few minutes and try again.

## "Can't reach the app's servers"

The internet works, but no request gets through to our servers. Most likely your provider blocks them, or zapret or a VPN gets in the way. See the [zapret and VPN section](../README.md#zapret-vpn-и-списки-доменов) and open Settings, Network.

## Where the log is

Open Settings, General, Help, Log file and the app shows `desktop.log`. To find it by hand:

| System | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\com.soundcloud.desktop\logs\desktop.log` |
| macOS | `~/Library/Logs/com.soundcloud.desktop/desktop.log` |
| Linux | `~/.local/share/com.soundcloud.desktop/logs/desktop.log` |

Attach this file when you report a problem on [Discord](https://discord.gg/xQcGBP8fGG) or in [discussion #144](https://github.com/zxcloli666/SoundCloud-Desktop/discussions/144).
