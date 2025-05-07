import React, { useEffect, useState } from 'react';

const SCENARIO_LABELS = {
  conservative: 'Conservative',
  base: 'Base',
  optimistic: 'Optimistic',
};

const HAIRCUT_TYPES = [
  { value: 'percent', label: 'Percent (%)' },
  { value: 'dollar', label: 'Dollar ($)' },
];

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString();
}

function formatCurrency(value) {
  return value !== undefined && value !== null
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '';
}

function formatNumber(value, decimals = 2) {
  return value !== undefined && value !== null
    ? Number(value).toFixed(decimals)
    : '';
}

export default function InventoryScenarios({ noCostInventoryHandling }) {
  const [scenarios, setScenarios] = useState([]);
  const [editedScenarios, setEditedScenarios] = useState({});
  const [calculations, setCalculations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [minSpendMargins, setMinSpendMargins] = useState({
    conservative: 40,
    base: 40,
    optimistic: 40,
  });

  // Fetch scenarios and calculations on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/inventory-scenarios').then(res => res.json()),
      fetch('/api/inventory-scenarios/calculations').then(res => res.json())
    ])
      .then(([scenariosData, calculationsData]) => {
        setScenarios(scenariosData);
        setEditedScenarios(
          scenariosData.reduce((acc, scenario) => {
            acc[scenario.scenarioType] = { ...scenario };
            return acc;
          }, {})
        );
        setCalculations(calculationsData);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load scenarios');
        setLoading(false);
      });
  }, [noCostInventoryHandling]);

  // Handle field changes
  const handleChange = (scenarioType, field, value) => {
    setEditedScenarios(prev => ({
      ...prev,
      [scenarioType]: {
        ...prev[scenarioType],
        [field]: value,
      },
    }));
    setSuccess(false);
  };

  // Save all scenarios
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await Promise.all(
        Object.values(editedScenarios).map(scenario =>
          fetch(`/api/inventory-scenarios/${scenario.scenarioType}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              haircutType: scenario.haircutType,
              haircutValue: Number(scenario.haircutValue),
              grossMargin: Number(scenario.grossMargin),
              ignored: scenario.ignored,
            }),
          })
        )
      );
      setSuccess(true);
      // Refetch to get updatedAt and calculations
      const [scenariosData, calculationsData] = await Promise.all([
        fetch('/api/inventory-scenarios').then(res => res.json()),
        fetch('/api/inventory-scenarios/calculations').then(res => res.json())
      ]);
      setScenarios(scenariosData);
      setEditedScenarios(
        scenariosData.reduce((acc, scenario) => {
          acc[scenario.scenarioType] = { ...scenario };
          return acc;
        }, {})
      );
      setCalculations(calculationsData);
    } catch (err) {
      setError('Failed to save scenarios');
    }
    setSaving(false);
  };

  if (loading) return <div>Loading scenarios...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  // Helper to get calculation for a scenario
  const getCalc = (type) => calculations.find(c => c.scenarioType === type) || {};

  const scenarioTypes = ['conservative', 'base', 'optimistic'];

  // Define grouped rows
  const groupedRows = [
    {
      group: 'Current Inventory',
      rows: [
        {
          label: 'Haircut (Type)',
          render: (type) => (
            <select
              value={editedScenarios[type].haircutType}
              onChange={e => handleChange(type, 'haircutType', e.target.value)}
            >
              {HAIRCUT_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ),
        },
        {
          label: 'Haircut (Value)',
          render: (type) => (
            <input
              type="number"
              step="any"
              value={editedScenarios[type].haircutValue}
              onChange={e => handleChange(type, 'haircutValue', e.target.value)}
              style={{ width: 80 }}
            />
          ),
        },
        {
          label: 'Gross Margin (%)',
          render: (type) => (
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={editedScenarios[type].grossMargin * 100}
              onChange={e => {
                let value = e.target.value;
                if (value < 0) value = 0;
                if (value > 100) value = 100;
                handleChange(type, 'grossMargin', value / 100);
              }}
              style={{ width: 80 }}
            />
          ),
        },
        {
          label: 'Adj. Inventory Value',
          render: (type) => formatCurrency(getCalc(type).adjustedInventoryValue),
        },
        {
          label: 'Revenue Potential',
          render: (type) => formatCurrency(getCalc(type).revenuePotential),
        },
      ],
    },
    {
      group: 'Sales Forecast',
      rows: [
        {
          label: 'Runway (Wks)',
          render: (type) => formatNumber(getCalc(type).runwayWeeks, 1),
        },
        {
          label: '12-Week Sales Goal',
          render: (type) => formatCurrency(getCalc(type).total12WeekSalesGoal),
        },
      ],
    },
    {
      group: 'Inventory Planning',
      rows: [
        {
          label: 'Revenue Difference',
          render: (type) => {
            const calc = getCalc(type);
            const diff = (calc.revenuePotential ?? 0) - (calc.total12WeekSalesGoal ?? 0);
            const isShortfall = Number(diff) < 0;
            return (
              <span style={{
                color: isShortfall ? '#d32f2f' : '#388e3c',
                fontWeight: 'bold'
              }}>
                {formatCurrency(diff)}
              </span>
            );
          },
        },
        {
          label: 'Reorder?',
          render: (type) => {
            const calc = getCalc(type);
            return (
              <span style={{
                color: calc.reorderNeeded ? 'red' : 'green',
                fontWeight: 'bold'
              }}>
                {calc.reorderNeeded ? 'Yes' : 'No'}
              </span>
            );
          },
        },
        {
          label: 'Gross Margin (%)',
          render: (type) => (
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={minSpendMargins[type]}
              onChange={e => {
                let value = e.target.value;
                if (value < 0) value = 0;
                if (value > 100) value = 100;
                setMinSpendMargins(prev => ({
                  ...prev,
                  [type]: value
                }));
              }}
              style={{ width: 80 }}
            />
          ),
        },
        {
          label: 'Minimum Spend',
          render: (type) => {
            const calc = getCalc(type);
            const margin = minSpendMargins[type] / 100;
            const shortfall = (calc.total12WeekSalesGoal ?? 0) - (calc.revenuePotential ?? 0);
            const minSpend = calc.reorderNeeded ? shortfall * (1 - margin) : 0;
            return calc.reorderNeeded ? formatCurrency(minSpend) : '-';
          },
        },
      ],
    },
  ];

  return (
    <div>
      <h2>Inventory Scenarios</h2>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          marginBottom: 16,
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr>
            <th style={{ width: 180 }}></th>
            {scenarioTypes.map(type => (
              <th
                key={type}
                style={{
                  opacity: editedScenarios[type]?.ignored ? 0.5 : 1,
                  textAlign: 'center',
                  fontSize: 18,
                  padding: '12px 0'
                }}
              >
                {SCENARIO_LABELS[type]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedRows.map(group => (
            <React.Fragment key={group.group}>
              <tr>
                <td
                  colSpan={scenarioTypes.length + 1}
                  style={{
                    fontWeight: 'bold',
                    background: '#f5f5f5',
                    padding: '16px 0 8px 0',
                    fontSize: 16,
                    borderTop: '2px solid #e0e0e0'
                  }}
                >
                  {group.group}
                </td>
              </tr>
              {group.rows.map(row => (
                <tr key={row.label}>
                  <td style={{ fontWeight: 'bold', padding: '10px 8px', fontSize: 15 }}>
                    {row.label}
                  </td>
                  {scenarioTypes.map(type => (
                    <td
                      key={type}
                      style={{
                        opacity: editedScenarios[type]?.ignored ? 0.5 : 1,
                        textAlign: 'center',
                        padding: '10px 8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {React.isValidElement(row.render(type))
                          ? React.cloneElement(row.render(type), { style: { width: 100, textAlign: 'center' } })
                          : row.render(type)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '8px 24px',
          fontSize: 16,
          borderRadius: 6,
          background: '#888',
          color: '#fff',
          border: 'none',
          marginTop: 8,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1
        }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {success && <span style={{ color: 'green', marginLeft: 12 }}>Saved!</span>}
    </div>
  );
}