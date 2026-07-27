"""Nightly Apriori batch job.

    python -m jobs.apriori

Regenerates every segment's association rules from completed transaction history.
The same routine backs the admin dashboard's manual trigger, so a run from the
command line and a run from the UI produce identical output.
"""

import asyncio

from app.database import SessionFactory, engine
from app.services.apriori import MIN_LIFT, MIN_SUPPORT, generate


async def main() -> None:
    async with SessionFactory() as session:
        reports = await generate(session)

    print(f"min_support={MIN_SUPPORT}  min_lift={MIN_LIFT}\n")
    print(f"{'segment':10} {'baskets':>8} {'itemsets':>9} {'rules':>6}")
    for report in reports:
        print(
            f"{report.segment:10} {report.baskets:>8} "
            f"{report.itemsets:>9} {report.rules:>6}"
        )

    total = sum(report.rules for report in reports)
    print(f"\n{total} rules written to apriori_rules")
    if any(report.baskets and not report.rules for report in reports):
        print(
            "Some segments produced no rules at this threshold. That is a finding "
            "about basket volume, not a reason to lower the floor."
        )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
