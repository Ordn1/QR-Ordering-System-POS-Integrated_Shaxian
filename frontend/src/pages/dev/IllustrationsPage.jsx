import { useState } from 'react';

import OrderProgress from '../../components/customer/progress/OrderProgress';
import StageIllustration from '../../components/customer/progress/StageIllustration';
import Button from '../../components/shared/Button';

const STAGES = ['unpaid', 'pending', 'preparing', 'ready', 'completed'];
const QUEUE_LABEL = 'Q-012';
const START_AHEAD = 3;
const silent = () => {};

export default function IllustrationsPage() {
  const [runs, setRuns] = useState({});
  const [ahead, setAhead] = useState(START_AHEAD);
  const [step, setStep] = useState(0);

  return (
    <main className="illustrations-page">
      <h1>Order progress</h1>
      <div className="illustrations-grid">
        {STAGES.map((stage) => (
          <figure className="illustrations-cell" key={stage} data-stage={stage}>
            <div className="order-progress-art">
              <StageIllustration
                key={runs[stage] ?? 0}
                stage={stage}
                live={Boolean(runs[stage])}
                ahead={ahead}
                queueLabel={QUEUE_LABEL}
                onCue={silent}
              />
            </div>
            <figcaption>
              {stage}
              <Button
                variant="secondary"
                data-replay={stage}
                onClick={() => setRuns((previous) => ({ ...previous, [stage]: (previous[stage] ?? 0) + 1 }))}
              >
                Replay entrance
              </Button>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="illustrations-live">
        <div className="illustrations-actions">
          <Button variant="secondary" data-next onClick={() => setStep((current) => (current + 1) % STAGES.length)}>
            Next stage
          </Button>
          <Button variant="secondary" data-queue onClick={() => setAhead((count) => (count > 0 ? count - 1 : START_AHEAD))}>
            Queue moves
          </Button>
        </div>
        <OrderProgress stage={STAGES[step]} ahead={ahead} queueLabel={QUEUE_LABEL} />
      </div>
    </main>
  );
}
