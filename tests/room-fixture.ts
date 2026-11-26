import { seedCatalog } from '../src/data/catalog';
import type { Catalog } from '../src/domain/types';

export function singleRoomCatalog(count: number): Catalog {
  const room = seedCatalog.rooms[0];
  const originals = seedCatalog.photos.filter(photo => photo.room === room.id);
  const photos = Array.from({ length: count }, (_, index) => ({
    ...originals[index % originals.length], id: `room-photo-${index + 1}`,
  }));
  return { ...seedCatalog, rooms: [room], photos, galleries: { [room.id]: photos.map(photo => photo.id) } };
}
