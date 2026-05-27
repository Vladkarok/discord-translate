# Discord Developer Portal setup

A one-time, ~5-minute walk-through. You end up with three values
(`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, your install URL) and the right
flags set so the `Apps → Translate` context-menu command appears in
DMs after a user install.

## 1. Create the application

1. Go to https://discord.com/developers/applications and click
   **New Application**.
2. Name it (e.g. `discord-translate`), accept the ToS, **Create**.
3. On the **General Information** tab, copy **Application ID** →
   this is `DISCORD_CLIENT_ID` for your `.env`.

## 2. Create the bot user

1. Sidebar → **Bot** → **Reset Token** → confirm.
2. Copy the token immediately (it's shown once) → this is
   `DISCORD_TOKEN` for your `.env`.
3. **Public Bot** can stay on or off — irrelevant for user-installed
   apps with a private allowlist.
4. **Privileged Gateway Intents:** leave **all three off**
   (Presence, Server Members, Message Content). This bot uses
   message-context commands, which deliver the target message in
   the interaction payload — no privileged intent needed. Keeping
   them off also keeps the install scope tight.

## 3. Enable user install

1. Sidebar → **Installation**.
2. Under **Installation Contexts**, enable **User Install**
   (and optionally Guild Install — you can leave it off if you
   never plan to add the bot to a server).
3. Under **Install Link**, pick **Discord Provided Link**. Copy
   the generated URL — this is the link you share with friends
   (and use yourself) to install the bot to your account.
4. Under **Default Install Settings → User Install**:
   - **Scopes:** `applications.commands` only.
   - **Permissions:** none required.

Save changes.

## 4. (Optional) cosmetic polish

- **General Information → App Icon**: upload an image.
- **General Information → Description**: shown when users inspect
  the bot. Short, accurate.

## 5. Find your own Discord ID

For `OWNER_DISCORD_ID` and for `/friends add user_id:...` later:

1. In Discord client → **User Settings** (gear, bottom-left).
2. **Advanced** → toggle **Developer Mode** on.
3. Right-click your own avatar anywhere → **Copy User ID**.

Friends find theirs the same way and send it to you privately.

## 6. Install the bot on your account

Open the install URL from step 3 in a browser, authorize. Restart
your Discord client (or hit Ctrl/Cmd + R) to refresh the slash command
cache. Then:

- Right-click any text message in any DM → **Apps → Translate**
  should appear.
- Type `/` in any chat → `quota`, `settings`, `friends`, `access`
  should be in the autocomplete.

If `/`-commands don't appear: wait 60 seconds and Ctrl/Cmd + R again.
Global command propagation is usually instant but can take a minute.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Apps → Translate` missing in DM | User-install not enabled on the app, or you opened the link as the wrong account, or Discord client cache stale (Ctrl/Cmd + R) |
| Slash commands missing | Same as above, plus check `docker compose logs bot \| grep commands` for a registration success line |
| "This interaction failed" | Bot is down or restarted between defer and reply — check logs |
| Bot replies "Not allowlisted" to a friend | Run `/friends add` for them as owner, then they retry |

## Reference

- Discord application commands:
  https://discord.com/developers/docs/interactions/application-commands
- User-installable apps:
  https://discord.com/developers/docs/tutorials/developing-a-user-installable-app
