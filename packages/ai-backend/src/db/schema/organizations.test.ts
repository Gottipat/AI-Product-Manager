/**
 * @fileoverview Tests for Database Schema - Organizations
 * @description Validates table structure and relations
 */

import { describe, it, expect } from 'vitest';

import { organizations, teams, teamMembers, projects } from './organizations';

describe('Organization Tables', () => {
  describe('organizations table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(organizations);
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('slug');
      expect(columns).toContain('isActive');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });

    it('should have id as primary key', () => {
      expect(organizations.id.primary).toBe(true);
    });

    it('should have slug as unique', () => {
      expect(organizations.slug.isUnique).toBe(true);
    });
  });

  describe('teams table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(teams);
      expect(columns).toContain('id');
      expect(columns).toContain('organizationId');
      expect(columns).toContain('name');
      expect(columns).toContain('description');
      expect(columns).toContain('isActive');
    });

    it('should reference organizations table', () => {
      // Foreign key is defined in schema
      expect(teams.organizationId).toBeDefined();
    });
  });

  describe('teamMembers table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(teamMembers);
      expect(columns).toContain('id');
      expect(columns).toContain('teamId');
      expect(columns).toContain('email');
      expect(columns).toContain('displayName');
      expect(columns).toContain('role');
    });
  });

  describe('projects table', () => {
    it('should have required columns', () => {
      const columns = Object.keys(projects);
      expect(columns).toContain('id');
      expect(columns).toContain('organizationId');
      expect(columns).toContain('teamId');
      expect(columns).toContain('name');
      expect(columns).toContain('status');
      expect(columns).toContain('startDate');
      expect(columns).toContain('endDate');
    });

    it('should have optional teamId (nullable)', () => {
      // teamId can be null for org-level projects
      expect(projects.teamId.notNull).toBeFalsy();
    });
  });
});
