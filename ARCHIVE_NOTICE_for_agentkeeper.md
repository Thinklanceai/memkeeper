# ⚠️ This project has been archived

AgentKeeper started as an experiment in agent-memory tooling. Its useful core
— the cross-platform memory importers — has been rewritten in TypeScript and
ported into [MemKeeper](https://github.com/Thinklanceai/memkeeper), where
people can actually use it through a browser instead of `pip install`.

The work on agent identity and authorization continues — in a separate,
stronger primitive — in
[HumanRoot](https://github.com/Thinklanceai/humanroot): delegation
certificates plus an MCP enforcement proxy that can wrap any MCP server and
prove which human authorized which action, with which scopes, until when.

**For users of AgentKeeper:**
- Memory comparison and management → [MemKeeper](https://github.com/Thinklanceai/memkeeper)
- Agent delegation, scopes, audit → [HumanRoot](https://github.com/Thinklanceai/humanroot)

The code below remains under its original license for reference. No further
releases are planned in this repository.

---

(original README continues below)
