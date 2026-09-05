#!/usr/bin/env bash
# Verifies a deployed `agent-runner` Edge Function.
#
#   ./supabase/scripts/verify-health.sh <project-ref> [attempts]
#
# Calls `GET /health`, waits for the new revision to answer, and asserts that
# the function reports itself healthy and that every REQUIRED secret is
# present. The endpoint returns presence booleans only — never values — so the
# response is safe to print in CI logs.
#
# Set AGENT_RUNNER_BASE_URL to point at a local `deno run` instead, e.g.
#   AGENT_RUNNER_BASE_URL=http://127.0.0.1:8000 ./supabase/scripts/verify-health.sh local
set -euo pipefail

ref="${1:-${SUPABASE_PROJECT_REF:-}}"
attempts="${2:-8}"

if [[ -z "$ref" ]]; then
  echo "usage: $0 <project-ref> [attempts]" >&2
  exit 2
fi
for tool in curl jq; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: '$tool' is required" >&2; exit 2; }
done

function_url="${AGENT_RUNNER_BASE_URL:-https://${ref}.supabase.co/functions/v1/agent-runner}"
health_url="${function_url%/}/health"

echo "Function URL : ${function_url}"
echo "Health URL   : ${health_url}"
echo

code=""
body=""
for ((i = 1; i <= attempts; i++)); do
  response="$(curl -sS --max-time 20 -w $'\n%{http_code}' "$health_url" 2>/dev/null || true)"
  code="${response##*$'\n'}"
  body="${response%$'\n'*}"
  if [[ "$code" == "200" ]]; then
    break
  fi
  echo "attempt ${i}/${attempts}: HTTP ${code:-000} — waiting 5s for the new revision..."
  sleep 5
done

if [[ "$code" != "200" ]]; then
  echo "::error::agent-runner /health returned HTTP ${code:-000}"
  echo "$body"
  exit 1
fi

echo "$body" | jq .
echo

fail=0
if ! echo "$body" | jq -e '.ok == true and .service == "agent-runner"' >/dev/null; then
  echo "::error::Unexpected /health payload (expected ok=true, service=agent-runner)."
  fail=1
fi

# These four are the function's REQUIRED secrets (lib/config.ts). Anything else
# is optional and only reported.
required=(SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY OPENROUTER_API_KEY)
for name in "${required[@]}"; do
  present="$(echo "$body" | jq -r --arg n "$name" '.secrets[$n]')"
  if [[ "$present" == "true" ]]; then
    echo "  ✓ ${name} present"
  else
    echo "::error::Required secret \"${name}\" is NOT set on the deployed function. Fix: supabase secrets set ${name}=... --project-ref ${ref}"
    fail=1
  fi
done

optional_present="$(echo "$body" | jq -r '[.secrets | to_entries[] | select(.value == true) | .key] - ["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","OPENROUTER_API_KEY"] | join(", ")')"
echo "  · optional secrets present: ${optional_present:-none (defaults in use)}"
echo "  · model: $(echo "$body" | jq -r '.model')"
echo

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## agent-runner deployed"
    echo
    echo "| | |"
    echo "|---|---|"
    echo "| Function URL | \`${function_url}\` |"
    echo "| Health | \`${health_url}\` → HTTP ${code} |"
    echo "| Model | \`$(echo "$body" | jq -r '.model')\` |"
    echo "| Terminal status | \`$(echo "$body" | jq -r '.terminal_status')\` |"
    echo
    echo "### Secret presence (names only — values are never disclosed)"
    echo
    echo "| Secret | Present |"
    echo "|---|---|"
    echo "$body" | jq -r '.secrets | to_entries[] | "| `\(.key)` | \(if .value then "✅" else "—" end) |"'
  } >>"$GITHUB_STEP_SUMMARY"
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "agent-runner is healthy at ${function_url}"
