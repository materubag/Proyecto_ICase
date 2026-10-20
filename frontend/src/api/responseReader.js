export async function readApiResponse(response) {
  const raw=await response.text();
  try { return raw ? JSON.parse(raw) : {}; }
  catch {
    const messages={502:'El backend no esta disponible temporalmente. Espera a que termine el reinicio y recarga la pantalla.',503:'El servicio no esta disponible temporalmente.',504:'El servidor agoto el tiempo de espera. Comprueba el resultado guardado antes de repetir la generacion.'};
    throw new Error(messages[response.status] || 'El servidor devolvio una respuesta no valida (HTTP '+response.status+').');
  }
}
