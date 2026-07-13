import { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { mockTrips } from '../data/mockData';

export function useTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const tripsRef = collection(db, 'trips');
      const unsubscribe = onSnapshot(tripsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({ 
            docId: doc.id, 
            id: data.id || doc.id,
            title: data.title || '',
            country: data.country || '',
            duration: data.duration || '',
            departure: data.departure || '',
            date: data.date || '',
            price: data.price || '',
            spotsTotal: (data.spotsTotal !== undefined && data.spotsTotal !== null && data.spotsTotal !== '') ? Number(data.spotsTotal) : null,
            spotsLeft: (data.spotsLeft !== undefined && data.spotsLeft !== null && data.spotsLeft !== '') ? Number(data.spotsLeft) : null,
            status: data.status || 'Ativo',
            description: data.description || '',
            included: data.included || '',
            image: data.image || '',
            tags: data.tags || [],
            route: data.route || [],
            itinerary: data.itinerary || [],
            mapImage: data.mapImage || '',
            mapDistances: data.mapDistances || '',
            videoUrl: data.videoUrl || '',
            videoTitle: data.videoTitle || ''
          });
        });
        
        setTrips(list);
        setLoading(false);
      }, (error) => {
        console.error("Erro ao carregar viagens do Firestore:", error);
        setTrips([]);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setTrips(mockTrips);
      setLoading(false);
    }
  }, []);

  return { trips, loading };
}
