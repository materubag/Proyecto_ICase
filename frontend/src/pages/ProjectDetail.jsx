import React, { useState } from 'react';
import { projectsApi } from '../api/projects.api';

import ProjectSummary from './ProjectSummary';
import ProjectSources from './ProjectSources';
import ProjectRequirements from './ProjectRequirements';
import ProjectPlanning from './ProjectPlanning';
import ProjectModeling from './ProjectModeling';
import ProjectNavigation from './ProjectNavigation';
import ProjectPrototype from './ProjectPrototype';
import ProjectArchitecture from './ProjectArchitecture';
import ProjectToolsTeam from './ProjectToolsTeam';
import ProjectEngineering from './ProjectEngineering';
import ProjectCodeGen from './ProjectCodeGen';

export default function ProjectDetail({
  project,
  onBack,
  onProjectUpdated,
  activeTab = 'summary',
  onTabChange,
  pendingCandidatesCount = 0
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(project.name || '');
  const [descValue, setDescValue] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nameValue.trim()) return;
    try {
      setSaving(true);
      await projectsApi.update(project.id, {
        name: nameValue.trim(),
        description: descValue.trim(),
        systemDescription: descValue.trim()
      });
      setIsEditing(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = () => {
    switch (project.status) {
      case 'IN_PROGRESS':
        return <span className="badge badge-in-progress">En Progreso</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">Completado</span>;
      default:
        return <span className="badge badge-planning">Planificación</span>;
    }
  };

  return (
    <div className="full-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#FFFFFF' }}>
      {/* Module Workspace Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'summary' && (
          <ProjectSummary project={project} onProjectUpdated={onProjectUpdated} onNavigateTo={onTabChange} />
        )}
        {(activeTab === 'requirements' || activeTab === 'candidates' || activeTab === 'actors') && (
          <ProjectRequirements
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialSubTab={activeTab === 'candidates' ? 'candidates' : activeTab === 'actors' ? 'actors' : 'candidates'}
          />
        )}
        {activeTab === 'sources' && (
          <ProjectSources
            project={project}
            onProjectUpdated={onProjectUpdated}
            onNavigateToReview={() => onTabChange('requirements')}
            onNavigateToSummary={() => onTabChange('summary')}
          />
        )}
        {activeTab === 'planning' && (
          <ProjectPlanning project={project} />
        )}
        {(activeTab === 'modeling' || activeTab === 'diagrams' || activeTab === 'model' || activeTab === 'usecases') && (
          <ProjectModeling
            project={project}
            initialSubTab={activeTab === 'usecases' ? 'usecases' : 'er'}
          />
        )}
        {activeTab === 'navigation' && (
          <ProjectNavigation project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {(activeTab === 'mockups' || activeTab === 'prototype') && (
          <ProjectPrototype project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {activeTab === 'architecture' && (
          <ProjectArchitecture project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {activeTab === 'tools_team' && (
          <ProjectToolsTeam project={project} onNavigateTo={onTabChange} />
        )}
        {['traceability', 'changes', 'versions', 'chat'].includes(activeTab) && (
          <ProjectEngineering project={project} view={activeTab} onProjectUpdated={onProjectUpdated} />
        )}
        {activeTab === 'codegen' && (
          <ProjectCodeGen project={project} onNavigateTo={onTabChange} />
        )}
      </div>
    </div>
  );
}
