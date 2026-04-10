# Incident Report: PostgreSQL Ransomware & Cryptominer Attack

**Date:** 2026-04-10  
**Severity:** High  
**Status:** Resolved  
**Service affected:** `server-postgres-1` (Docker container), `grid_print` database  
**Reported by:** Claude Code (automated detection during log inspection)

---

## Summary

An automated bot exploited an exposed PostgreSQL port (5432 bound to `0.0.0.0`) to gain access to the database server. The attacker created a backdoor superuser account (`priv_esc`), dropped the `grid_print` database, and left a ransom note demanding 0.0069 BTC. They also downloaded cryptominer/bot binaries (`/tmp/init`, `/tmp/mysql`) into the container. The malware payload was partially blocked by the OS (child processes killed via signal 9), preventing full execution. The `grid_print` database had already been manually recreated before this investigation.

---

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-04-10 01:45 | PostgreSQL Docker container started fresh |
| 2026-04-10 05:33 | Attacker connected to public port 5432, created `readme_to_recover` database (ransom note) — `grid_print` was likely dropped at this point |
| 2026-04-10 06:13 | Container restarted |
| 2026-04-10 06:16 | `grid_print` database manually recreated by team |
| 2026-04-10 08:06 | Second attack wave — attacker ran `COPY TO PROGRAM` and `CREATE FUNCTION system()` SQL injection exploits; malware binaries `/tmp/init` (2.7 MB) and `/tmp/mysql` (2.0 MB) written to container `/tmp/` |
| 2026-04-10 08:06 | OS killed the malware child processes (signal 9) before payload completed |
| 2026-04-10 08:10–08:17 | Continued brute-force login attempts from external IPs |
| 2026-04-10 08:21 | Login endpoint returning HTTP 500 (DB connection broken — attacker had changed postgres password) |
| 2026-04-10 08:31 | Incident detected and remediation began |
| 2026-04-10 08:31 | `priv_esc` superuser account dropped, `readme_to_recover` deleted, postgres password reset |
| 2026-04-10 08:31 | Malware binaries `/tmp/init` and `/tmp/mysql` deleted from container |
| 2026-04-10 08:32 | `docker-compose.yml` updated to bind ports 5432 and 6379 to `127.0.0.1` only; containers restarted |
| 2026-04-10 08:33 | Server health confirmed: `database: connected` |

---

## Attack Vector

**Root cause:** PostgreSQL port 5432 was bound to `0.0.0.0:5432` in `docker-compose.yml`, exposing the database directly to the public internet. The default password (`postgres`) was in use, making brute-force trivial.

**Attack technique:** Standard automated PostgreSQL exploitation:
1. Connect to exposed port with brute-forced credentials
2. Use `COPY (SELECT '') TO PROGRAM '...'` to execute arbitrary shell commands
3. Use `CREATE FUNCTION system()` via `libc.so.6` as an alternative RCE path
4. Download cryptominer/bot binary from `http://181.214.147.108/bot`
5. Create a superuser backdoor account for persistent access

**Attacker infrastructure:**
- Malware download server: `http://181.214.147.108/bot`
- Ransom contact: `dzen+3xbkz@onionmail.org`
- Bitcoin wallet: `bc1qar0kc4z4avn7dnaatzfw56n7nzaz8kmcllz9pd`
- Ransom ID: `3XBKZ`

---

## Impact

| Item | Impact |
|---|---|
| `grid_print` database | Dropped by attacker (recreated manually before investigation) |
| Application data | **Potentially lost** — contents of `grid_print` at time of attack are unknown |
| Malware execution | **Blocked** — OS killed processes before payload ran |
| Credential exposure | postgres password was `postgres` (default/weak) — was known to attacker |
| Host filesystem | **Not compromised** — malware was contained to the Docker container |
| SSH access | **Not compromised** — no changes to `authorized_keys` found |
| Cron persistence | **Not established** — no malicious cron entries found |
| Redis | **Not exploited** — port was also public but no attack observed |

---

## Artifacts Removed

| Artifact | Type | Location |
|---|---|---|
| `priv_esc` | PostgreSQL backdoor superuser account | `pg_shadow` |
| `readme_to_recover` | Ransom note database | PostgreSQL databases |
| `/tmp/init` | ELF malware binary (2.7 MB) | Inside `server-postgres-1` container |
| `/tmp/mysql` | ELF malware binary / UPX-packed cryptominer (2.0 MB) | Inside `server-postgres-1` container |

---

## Remediation Applied

| Fix | Details |
|---|---|
| Port binding hardened | `5432` and `6379` changed from `0.0.0.0` to `127.0.0.1` in `docker-compose.yml` |
| Backdoor user removed | `DROP ROLE priv_esc` executed |
| Ransom DB removed | `DROP DATABASE readme_to_recover` executed |
| Malware binaries deleted | `/tmp/init` and `/tmp/mysql` removed from container |
| Postgres password reset | `ALTER USER postgres WITH PASSWORD '...'` to resync with `.env` |

---

## Outstanding Actions Required

> These require manual action by the team — Claude Code cannot execute them.

- [ ] **Change postgres password** from the default `postgres` to a strong random value in both `.env` and `docker-compose.yml`
- [ ] **Change Redis password** — add `requirepass <strong-password>` to Redis config and update app connection string
- [ ] **Rotate JWT_SECRET** in `.env` — current value `grid-jwt-secret-change-in-production` is insecure
- [ ] **Assess data loss** — determine what data was in `grid_print` before the attack and whether backups exist
- [ ] **Enable PostgreSQL backups** — set up automated pg_dump backups (daily minimum)
- [ ] **Review firewall rules** — ensure only port 22 (SSH) and 3000 (API) are internet-accessible on this host
- [ ] **Monitor for re-attack** — bots will retry; with ports now localhost-only this is blocked, but verify after any Docker restart

---

## Lessons Learned

1. **Never expose database ports to the internet.** Docker's default port mapping bypasses `ufw`/`iptables` — always use `127.0.0.1:PORT:PORT` for internal services.
2. **Never use default passwords** (`postgres`, `redis`) in production.
3. **Redis was also exposed** — Redis has no authentication by default and is a common attack vector.
4. **The attack was fully automated** — internet-exposed Postgres with a default password is found and exploited within hours of being online.

---

*Report generated: 2026-04-10 by Claude Code*
