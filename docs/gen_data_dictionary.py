"""Emit the data dictionary straight from the live database."""
import subprocess, collections, re, textwrap

SEP = "\x1f"
DB = ["psql", "-d", "shaxian_ordering", "-U", "shaxian_app", "-tAF" + SEP, "-c"]

def q(sql, width=None):
    """psql omits the trailing separator when the last field is empty, so pad."""
    out = subprocess.run(DB + [sql], capture_output=True, text=True, check=True).stdout
    rows = [line.split(SEP) for line in out.strip().split("\n") if line.strip()]
    if rows:
        w = width or max(len(r) for r in rows)
        rows = [r + [""] * (w - len(r)) for r in rows]
    return rows

ORDER = ["tables","staff_accounts","categories","menu_items","sessions","session_devices",
         "transactions","transaction_items","kitchen_queue","payments","apriori_rules",
         "analytics_events","priority_verification_log","audit_log"]

PURPOSE = {
 "tables":"Registers every physical table and the unique QR token printed on its marker. Referenced by sessions.",
 "staff_accounts":"Login credentials for the Service Crew and System Administrator roles. Passwords are never stored in plaintext.",
 "categories":"Menu category records and the order their tabs appear in. Referenced by menu_items.",
 "menu_items":"Every orderable item, with the trilingual names, nutrition and allergen disclosures required by the Menu Information Module.",
 "sessions":"One ordering interaction from QR scan to checkout. Anchors transactions, devices, analytics and priority declarations. Demographic fields are populated by direct user input, never by a camera.",
 "session_devices":"Every phone that joins a table session. A Standard or single-device Priority session has one row; a Group session has two or more, enabling split-bill attribution.",
 "transactions":"Every placed order with its full tax and discount breakdown. Parent of transaction_items, payments and kitchen_queue, and the source read by the Apriori batch job.",
 "transaction_items":"Line items per transaction. The direct source of the market baskets used in Apriori computation.",
 "kitchen_queue":"Operationalises the fairness-bounded priority queue: live position plus the count of Standard orders a Priority order has advanced ahead of.",
 "payments":"One or more payment records per transaction, supporting both single-payer orders and split Group sessions.",
 "apriori_rules":"Association rules produced by the Apriori batch job, segmented by session_type and read at recommendation time.",
 "analytics_events":"Every interaction event from the React client. Primary source for the confusion-trigger and recommendation-acceptance rates.",
 "priority_verification_log":"Audit trail of every priority declaration. Stores only the last four digits of a presented ID; contains no image or biometric data.",
 "audit_log":"System action trail — staff record changes and outbound POS transmissions, with before/after state captured as JSON.",
}

cols = collections.defaultdict(list)
for t, n, typ, ln, prec, scale, nul, dflt in q("""
select table_name, column_name, data_type, coalesce(character_maximum_length::text,''),
       coalesce(numeric_precision::text,''), coalesce(numeric_scale::text,''),
       is_nullable, replace(replace(coalesce(column_default,''), chr(10), ' '), chr(13), ' ')
from information_schema.columns where table_schema='public' and table_name<>'alembic_version'
order by table_name, ordinal_position""", width=8):
    cols[t].append((n, typ, ln, prec, scale, nul, dflt))

pk, fk, uq, ck = (collections.defaultdict(list) for _ in range(4))
for tbl, kind, defn in q("""
select c.conrelid::regclass::text, c.contype::text, replace(pg_get_constraintdef(c.oid), chr(10), ' ')
from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
where n.nspname='public'"""):
    {"p": pk, "f": fk, "u": uq, "c": ck}[kind][tbl].append(defn)

enums = collections.defaultdict(list)
for name, label in q("""select t.typname, e.enumlabel from pg_type t
join pg_enum e on e.enumtypid=t.oid order by t.typname, e.enumsortorder"""):
    enums[name].append(label)

def typename(typ, ln, prec, scale):
    if typ == "USER-DEFINED": return "ENUM"
    if typ == "character varying": return f"VARCHAR({ln})"
    if typ == "character": return f"CHAR({ln})"
    if typ == "numeric": return f"NUMERIC({prec},{scale})"
    return {"bigint":"BIGINT","smallint":"SMALLINT","integer":"INTEGER","boolean":"BOOLEAN",
            "uuid":"UUID","jsonb":"JSONB","inet":"INET","date":"DATE",
            "timestamp with time zone":"TIMESTAMPTZ","text":"TEXT"}.get(typ, typ.upper())

def enum_for(table, col):
    row = q(f"""select t.typname from pg_attribute a
      join pg_type t on t.oid=a.atttypid
      where a.attrelid='{table}'::regclass and a.attname='{col}' and t.typtype='e'""")
    return row[0][0] if row else None

out = ["# Data Dictionary — QR-Based Table Ordering System",
       "",
       "Introspected directly from the running PostgreSQL database (`shaxian_ordering`).",
       "Every type, size, constraint and default below is what the schema actually enforces.",
       "",
       f"**Fourteen tables.** Table numbering continues the paper's sequence from Table 9.",
       ""]

for i, t in enumerate(ORDER, start=9):
    out += [f"## Table {i}. {t[0].upper() + t[1:]}", "", PURPOSE[t], "",
            "| Field Name | Data Type | Null | Default | Constraint |", "|---|---|---|---|---|"]
    pkcols = set()
    for d in pk.get(t, []):
        pkcols |= {c.strip() for c in re.search(r"\((.*)\)", d).group(1).split(",")}
    for n, typ, ln, prec, scale, nul, dflt in cols[t]:
        marks = []
        if n in pkcols: marks.append("PK")
        for d in fk.get(t, []):
            if re.match(rf"FOREIGN KEY \({n}\)", d):
                marks.append("FK → " + re.search(r"REFERENCES ([\w.]+)", d).group(1))
        for d in uq.get(t, []):
            inner = re.search(r"\((.*)\)", d).group(1)
            if n in [c.strip() for c in inner.split(",")]:
                marks.append(f"UNIQUE ({inner})" if "," in inner else "UNIQUE")
        tn = typename(typ, ln, prec, scale)
        if tn == "ENUM":
            e = enum_for(t, n)
            tn = f"ENUM ({' / '.join(enums[e])})" if e else "ENUM"
        default = ""
        if dflt and "nextval" in dflt: default = "auto (sequence)"
        elif dflt and dflt.startswith("'"): default = dflt.split("::")[0]
        elif dflt in ("true", "false"): default = dflt
        elif dflt and "now()" in dflt: default = "now()"
        elif dflt: default = dflt.split("::")[0][:24]
        out.append(f"| `{n}` | {tn} | {'Yes' if nul=='YES' else 'No'} | {default or '—'} | {', '.join(marks) or '—'} |")
    checks = [d for d in ck.get(t, [])]
    if checks:
        out += ["", "Check constraints:", ""]
        out += [f"- `{d}`" for d in sorted(checks)]
    out.append("")

out += ["## Enum types", "",
        "All status columns are PostgreSQL enum types, not free-text VARCHAR.", "",
        "| Type | Values |", "|---|---|"]
for name in sorted(enums):
    out.append(f"| `{name}` | {' / '.join(enums[name])} |")
out += ["", "## Key generation", "",
        "Prefixed identifiers are issued by PostgreSQL sequences through `key_default()` in",
        "`app/models/keys.py` and validated by check constraints:",
        "`TBL-NNNN`, `STF-NNNN`, `CAT-NNNN`, `MNU-NNNN`, `APR-NNNN`.", ""]

open("/Users/jkb/Documents/Shaxian/docs/data-dictionary.md","w").write("\n".join(out))
print("written:", len(out), "lines")
