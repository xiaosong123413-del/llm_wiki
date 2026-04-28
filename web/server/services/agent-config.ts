import {
  getAppConfigRelativePath,
  readAppConfig,
  saveAppConfig,
  type AppConfig,
  type AppConfigInput,
  type AppDefinition,
} from "./app-config.js";

interface AgentConfig {
  agents: AgentDefinition[];
  activeAgentId: string | null;
}

export type AgentDefinition = AppDefinition;

interface AgentConfigInput {
  agents?: unknown;
  activeAgentId?: unknown;
  apps?: unknown;
  defaultAppId?: unknown;
}

export function readAgentConfig(projectRoot: string): AgentConfig {
  const config = readAppConfig(projectRoot);
  return toLegacyAgentConfig(config);
}

export function saveAgentConfig(projectRoot: string, input: AgentConfigInput): AgentConfig {
  const config = saveAppConfig(projectRoot, input as AppConfigInput);
  return toLegacyAgentConfig(config);
}

export function getAgentConfigRelativePath(): string {
  return getAppConfigRelativePath();
}

function toLegacyAgentConfig(config: AppConfig): AgentConfig {
  return {
    agents: config.apps,
    activeAgentId: config.defaultAppId,
  };
}
