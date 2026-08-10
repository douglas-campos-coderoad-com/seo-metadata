'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useProjects } from '../hooks/useProjects';

interface ProjectFormProps {
  onCreated?: (projectId: string) => void;
}

export function ProjectForm({ onCreated }: ProjectFormProps) {
  const [name, setName] = useState('');
  const { createProject } = useProjects();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const project = createProject(trimmed);
    setName('');
    onCreated?.(project.id);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        placeholder="Project name"
        className="flex-1"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit">New project</Button>
    </form>
  );
}
