// Nome amigável a partir do login: "ana.souza@x.com" -> "Ana"
export function nomeDoEmail(email: string | undefined | null) {
  const base = (email || '').split('@')[0].split(/[._-]/)[0].replace(/\d+/g, '');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : email || '';
}
