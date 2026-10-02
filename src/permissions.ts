export type Role = "Administrador" | "Supervisor" | "Operador Técnico" | "Operador A" | "Consulta";
// Keep the stable database value; only its user-facing label changes.
export const roleLabel = (role: string) => role === "Operador A" ? "Operador" : role;
export const roles: Role[] = ["Administrador", "Supervisor", "Operador Técnico", "Operador A", "Consulta"];
export const roleRank = (role: Role) => roles.length - roles.indexOf(role);
export const can = (permissions: readonly string[], action: string) => permissions.includes(action);
