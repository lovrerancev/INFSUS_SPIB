const CAMUNDA_BASE = "/engine-rest";
export const PROCESS_KEY = "SPIB_ObradaNarudzbe";

export type CamundaTask = {
  id: string;
  name: string;
  taskDefinitionKey: string;
  processInstanceId: string;
  created: string;
  assignee: string | null;
};

export class CamundaError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CamundaError";
    this.status = status;
  }
}

async function camundaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CAMUNDA_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
    }
    throw new CamundaError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function varijable(obj: Record<string, string | number | boolean>) {
  const variables: Record<string, { value: string | number | boolean; type: string }> = {};
  for (const [k, v] of Object.entries(obj)) {
    variables[k] = {
      value: v,
      type: typeof v === "number" ? "Long" : typeof v === "boolean" ? "Boolean" : "String",
    };
  }
  return { variables };
}

export async function provjeriCamundu(): Promise<boolean> {
  try {
    await camundaFetch<{ version: string }>("/version");
    return true;
  } catch {
    return false;
  }
}

export async function pokreniProces(kupacUsername: string): Promise<string> {
  const r = await camundaFetch<{ id: string }>(
    `/process-definition/key/${PROCESS_KEY}/start`,
    {
      method: "POST",
      body: JSON.stringify(varijable({ kupacUsername })),
    },
  );
  return r.id;
}

export async function dohvatiTaskove(
  camundaUserId: string,
  candidateGroup?: string,
): Promise<CamundaTask[]> {
  const params = new URLSearchParams({ processDefinitionKey: PROCESS_KEY });
  if (candidateGroup) {
    params.set("candidateGroup", candidateGroup);
    params.set("unassigned", "true");
  } else {
    params.set("assignee", camundaUserId);
  }
  return camundaFetch<CamundaTask[]>(`/task?${params.toString()}`);
}

export async function preuzmiTask(taskId: string, camundaUserId: string): Promise<void> {
  await camundaFetch(`/task/${taskId}/claim`, {
    method: "POST",
    body: JSON.stringify({ userId: camundaUserId }),
  });
}

export async function zavrsiTask(
  taskId: string,
  variables: Record<string, string | number | boolean>,
): Promise<void> {
  await camundaFetch(`/task/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify(varijable(variables)),
  });
}
