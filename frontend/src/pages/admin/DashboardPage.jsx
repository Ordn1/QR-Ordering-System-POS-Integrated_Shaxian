import { BadgePercent, Receipt, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchSummary, runApriori } from '../../api/analytics';
import SalesTrendChart from '../../components/admin/SalesTrendChart';
import PriorityMixChart from '../../components/admin/PriorityMixChart';
import SegmentMixChart from '../../components/admin/SegmentMixChart';
import TopItemsChart from '../../components/admin/TopItemsChart';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import KpiCard from '../../components/shared/KpiCard';
import { peso } from '../../lib/format';
import { toast } from '../../store/toastStore';

const percent = (value) => `${Math.round(value * 100)}%`;
const SEGMENTS = ['all', 'standard', 'priority', 'group'];

export default function DashboardPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [mining, setMining] = useState(false);
  const [ruleSegment, setRuleSegment] = useState('all');

  useEffect(() => {
    fetchSummary()
      .then(setSummary)
      .catch((error) => toast.error(error.message));
  }, []);

  async function mine() {
    setMining(true);
    try {
      const run = await runApriori();
      const rules = run.segments.reduce((total, segment) => total + segment.rules, 0);
      toast.success(t('admin.aprioriDone', { rules, support: run.min_support }));
      setSummary(await fetchSummary());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setMining(false);
    }
  }

  if (!summary) {
    return (
      <main className="content-area">
        <header className="page-header">
          <h1>{t('admin.dashboardTitle')}</h1>
        </header>
      </main>
    );
  }

  const { headline, recommendation_funnel: funnel } = summary;
  const acceptance = funnel.shown ? funnel.accepted / funnel.shown : 0;
  const rules = summary.apriori_rules ?? [];
  const filteredRules =
    ruleSegment === 'all'
      ? rules
      : rules.filter((rule) => rule.session_type === ruleSegment);

  return (
    <main className="content-area">
      <header className="page-header">
        <h1>{t('admin.dashboardTitle')}</h1>
        <div className="page-header-actions">
          <Button variant="secondary" loading={mining} onClick={mine}>
            {t('admin.runApriori')}
          </Button>
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard label={t('admin.kpiOrders')} value={headline.orders} icon={Receipt} />
        <KpiCard
          label={t('admin.kpiGross')}
          value={peso(headline.gross_amount)}
          icon={BadgePercent}
        />
        <KpiCard
          label={t('admin.kpiAverage')}
          value={peso(headline.average_order)}
          icon={Receipt}
        />
        <KpiCard
          label={t('admin.kpiPriority')}
          value={percent(headline.priority_share)}
          delta={t('admin.kpiPriorityDelta', { count: headline.priority_declarations })}
          direction="up"
          icon={Users}
        />
      </div>

      <div className="dashboard-grid">
        <Card title={t('admin.chartSales')}>
          <SalesTrendChart data={summary.sales_by_day} label={t('admin.chartSalesSeries')} />
        </Card>

        <Card title={t('admin.chartSegments')}>
          <SegmentMixChart data={summary.segment_mix} label={t('admin.chartSegmentsSeries')} />
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title={t('admin.chartItems')}>
          <TopItemsChart data={summary.top_items} label={t('admin.chartItemsSeries')} />
        </Card>

        <Card title={t('admin.chartPriority')}>
          <PriorityMixChart
            data={summary.priority_mix}
            label={t('admin.chartPrioritySeries')}
            labelFor={(status) => t(`priorityStatus.${status}`)}
          />
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid-wide">
        <Card title={t('admin.chartRecommendations')}>
          <p className="dashboard-hero-number numeric">{percent(acceptance)}</p>
          <p className="dashboard-hero-caption">{t('admin.acceptanceCaption')}</p>
          <dl className="dashboard-facts">
            <dt>{t('admin.factShown')}</dt>
            <dd className="numeric">{funnel.shown}</dd>
            <dt>{t('admin.factAccepted')}</dt>
            <dd className="numeric">{funnel.accepted}</dd>
            <dt>{t('admin.factDismissed')}</dt>
            <dd className="numeric">{funnel.dismissed}</dd>
            <dt>{t('admin.factTriggerRate')}</dt>
            <dd className="numeric">{percent(headline.trigger_rate)}</dd>
            <dt>{t('admin.factVat')}</dt>
            <dd className="numeric">{peso(headline.vat_amount)}</dd>
            <dt>{t('admin.factDiscount')}</dt>
            <dd className="numeric">{peso(headline.discount_amount)}</dd>
          </dl>
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid-wide">
        <Card
          title={`Apriori Association Rules (${filteredRules.length})`}
          actions={
            <div className="table-row-actions">
              {SEGMENTS.map((segment) => (
                <Button
                  key={segment}
                  variant={ruleSegment === segment ? 'primary' : 'secondary'}
                  onClick={() => setRuleSegment(segment)}
                >
                  {segment.charAt(0).toUpperCase() + segment.slice(1)}
                </Button>
              ))}
            </div>
          }
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Segment</th>
                  <th>If In Basket (Antecedents)</th>
                  <th>Suggested Item (Consequent)</th>
                  <th>Support</th>
                  <th>Confidence</th>
                  <th>Lift</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.rule_id}>
                    <td className="numeric">{rule.rule_id}</td>
                    <td>{rule.session_type}</td>
                    <td>{rule.antecedents.join(' + ')}</td>
                    <td>{rule.consequents.join(', ')}</td>
                    <td className="numeric">{(rule.support * 100).toFixed(1)}%</td>
                    <td className="numeric">{(rule.confidence * 100).toFixed(1)}%</td>
                    <td className="numeric">{rule.lift.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No association rules found for this segment.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}