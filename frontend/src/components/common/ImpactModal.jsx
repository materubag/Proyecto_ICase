import React from 'react';
import Modal from './Modal';
export default function ImpactModal({ change, onClose, onConfirm, busy }) {
  const impact = change?.impact;
  return <Modal isOpen={!!change} onClose={onClose} title="Revisar impacto del cambio" footer={<><button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={onConfirm} disabled={busy}>Continuar y aprobar</button></>}>
    <p>Este cambio puede afectar otros elementos. Se conservará el historial.</p>
    <p>{change?.reason}</p>
    <h4>Impactos directos</h4><ul>{(impact?.directImpacts || []).map(x => <li key={`${x.type}:${x.id}`}>{x.type}: {x.name || x.id}</li>)}</ul>
    <h4>Impactos indirectos</h4><ul>{(impact?.indirectImpacts || []).map(x => <li key={`${x.type}:${x.id}`}>{x.type}: {x.name || x.id}</li>)}</ul>
    {!impact?.directImpacts?.length && <p>No se encontraron dependencias registradas.</p>}
    <details><summary>Estado propuesto y calidad</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(change?.proposedState, null, 2)}</pre></details>
  </Modal>;
}
