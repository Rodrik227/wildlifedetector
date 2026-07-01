export interface CatalogedAnimal {
  id: string;
  name: string;
  scientificName?: string;
  category: 'mammal' | 'bird' | 'reptile' | 'amphibian' | 'fish' | 'insect' | 'other';
  notes: string;
  location: string;
  timestamp: number;
  imageUrl: string; // base64 DataURL
  temperature: number; // degrees Celsius
  humidity: number; // percentage
  detectionType: 'manual' | 'automatic';
}

export type AnimalCategory = CatalogedAnimal['category'];

export interface SensorData {
  temperature: number;
  humidity: number;
  timestamp: number;
}
