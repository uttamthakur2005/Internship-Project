import { useEffect, useState } from "react";

export default function StockPath() {
  const [q, setQ] = useState(1240);
  const [k, setK] = useState(0);
  useEffect(() => {
    const seq = [24, -8, 36, -14, 18];
    let i = 0;
    const t = setInterval(() => {
      setQ((x) => Math.max(0, x + seq[i % seq.length]));
      setK((x) => x + 1);
      i++;
    }, 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="stock-visual"
      aria-label="Animated inventory flow illustration"
    >
      <div className="stock-visual-top">
        <span>
          <i /> STOCK FLOW PREVIEW
        </span>
        <span className="stock-date">ILLUSTRATIVE</span>
      </div>
      <div className="stock-chart">
        <div className="chart-caption">
          <span>Sample inventory trend</span>
          <b>MOTION PREVIEW</b>
        </div>
        <div className="chart-bars" aria-hidden="true">
          {[34, 48, 39, 62, 49, 78, 58, 88, 66, 100, 75, 91].map(
            (height, index) => (
              <i
                key={index}
                style={{
                  "--bar-height": `${height}%`,
                  "--bar-delay": `${index * 55}ms`,
                }}
              />
            ),
          )}
        </div>
        <div className="chart-axis">
          <span>MON</span>
          <span>TUE</span>
          <span>WED</span>
          <span>THU</span>
          <span>FRI</span>
          <span>SAT</span>
          <span>SUN</span>
        </div>
      </div>
      <div className="flow-card">
        <div className="flow-card-heading">
          <span>Example stock quantity</span>
          <span className="live-tag">
            <i /> SAMPLE
          </span>
        </div>
        <div className="flow-total">
          <strong key={k}>{q.toLocaleString("en-IN")}</strong>
          <span>units</span>
          <em>↑ healthy</em>
        </div>
        <div className="flow-track">
          <div className="flow-endpoint">
            <span className="flow-icon purchase-icon">↓</span>
            <span>
              <b>Purchase</b>
              <small>stock in</small>
            </span>
          </div>
          <div className="flow-line">
            <i />
            <i />
          </div>
          <div className="flow-engine">
            <span>IMS</span>
            <small>stockService</small>
          </div>
          <div className="flow-line flow-line-last">
            <i />
          </div>
          <div className="flow-endpoint">
            <span className="flow-icon sale-icon">↑</span>
            <span>
              <b>Sale</b>
              <small>stock out</small>
            </span>
          </div>
        </div>
        <div className="flow-card-foot">
          <span>
            <i /> Stock changes leave a history
          </span>
          <span>Illustrative</span>
        </div>
      </div>
    </div>
  );
}
