export default function ProductoraResource(productora) {
  const ownerProfile = productora.profiles.find(
    p => p.roles.some(r => r.role === 'OWNER')
  );
  const owner = ownerProfile ? ownerProfile.user : null;

  return {
    id: productora.id.toString(),
    code: productora.code,
    name: productora.name,
    email: productora.email,
    owner: owner
      ? {
          name: owner.name,
          email: owner.email,
          initials: owner.name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
        }
      : null,
    totalEvents: productora.totalEvents,
    activeEvents: productora.activeEvents,
    totalOrganizers: productora.totalOrganizers,
    totalRevenue: new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(productora.totalRevenue),
    status: productora.status === 'activa' ? 'Activa' : 'Inactiva'
  };
}
