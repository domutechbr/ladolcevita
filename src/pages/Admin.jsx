import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Eye, EyeOff, LayoutDashboard, PlusCircle, Settings, 
  LogOut, CheckCircle, Database, Mail, Edit2, Trash2, X, AlertCircle, RefreshCw, MessageSquare, Globe, MapPin, Camera, Video
} from 'lucide-react';
import { mockTrips, mockTestimonials, mockDestinations, mockMoments } from '../data/mockData';
import { db, auth, isFirebaseConfigured } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { useSettings } from '../context/SettingsContext';

// Helper to compress images client-side before saving to Firestore (keeps files under Firestore document size limits)
const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('alanfelipe1678@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  
  // Custom Toast Feedback state
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 4000);
  };

  // Dashboard states
  const [activeTab, setActiveTab] = useState('trips'); // 'trips' | 'contacts' | 'testimonials' | 'destinations' | 'moments'
  const [trips, setTrips] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [moments, setMoments] = useState([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(false);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [isLoadingMoments, setIsLoadingMoments] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modais e formulários
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingTripId, setEditingTripId] = useState(null);

  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [testimonialModalMode, setTestimonialModalMode] = useState('add'); // 'add' | 'edit'
  const [editingTestimonialId, setEditingTestimonialId] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState({
    name: '',
    location: '',
    trip: '',
    stars: 5,
    text: ''
  });

  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [destinationModalMode, setDestinationModalMode] = useState('add'); // 'add' | 'edit'
  const [editingDestinationId, setEditingDestinationId] = useState(null);
  const [destinationForm, setDestinationForm] = useState({
    title: '',
    country: 'Itália',
    description: '',
    image: '',
    tagsString: '',
    highlightsString: ''
  });

  const [isMomentModalOpen, setIsMomentModalOpen] = useState(false);
  const [momentModalMode, setMomentModalMode] = useState('add'); // 'add' | 'edit'
  const [editingMomentId, setEditingMomentId] = useState(null);
  const [momentForm, setMomentForm] = useState({
    type: 'photo', // 'photo' | 'video'
    category: 'Itália', // 'Itália' | 'Portugal' | 'Experiências'
    title: '',
    location: '',
    date: '',
    description: '',
    image: '',
    videoUrl: ''
  });

  // Estado para controle de upload de imagem
  const [imageInputMode, setImageInputMode] = useState('url'); // 'url' | 'upload'
  const [imageUploadPreview, setImageUploadPreview] = useState(null);
  const [mapImageInputMode, setMapImageInputMode] = useState('url'); // 'url' | 'upload'
  const [mapImageUploadPreview, setMapImageUploadPreview] = useState(null);
  const [sendPush, setSendPush] = useState(false);

  const handleImageFileChange = async (e, formType = 'trip') => {
    const file = e.target.files[0];
    if (!file) return;

    // Verificar tamanho (máximo 15MB com compressão automática)
    if (file.size > 15 * 1024 * 1024) {
      showFeedback('error', 'Imagem muito grande! Máximo 15MB.');
      e.target.value = '';
      return;
    }

    try {
      showFeedback('success', 'Processando e otimizando imagem...');
      const compressedBase64 = await compressImage(file, 1200, 1200, 0.7);
      
      if (formType === 'tripMap') {
        setMapImageUploadPreview(compressedBase64);
        setTripForm(prev => ({ ...prev, mapImage: compressedBase64 }));
      } else {
        setImageUploadPreview(compressedBase64);
        if (formType === 'destination') {
          setDestinationForm(prev => ({ ...prev, image: compressedBase64 }));
        } else if (formType === 'moment') {
          setMomentForm(prev => ({ ...prev, image: compressedBase64 }));
        } else {
          setTripForm(prev => ({ ...prev, image: compressedBase64 }));
        }
      }
      showFeedback('success', 'Imagem otimizada com sucesso!');
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      showFeedback('error', 'Erro ao otimizar imagem.');
    }
  };
  
  // Trip Form State
  const [tripForm, setTripForm] = useState({
    title: '',
    country: 'Itália',
    duration: '',
    departure: 'São Paulo/SP',
    date: '',
    price: '',
    hidePrice: false,
    spotsTotal: 12,
    spotsLeft: 12,
    status: 'Ativo',
    description: '',
    image: '',
    tagsString: '', // Separados por vírgula
    routeString: '', // Separados por vírgula
    mapImage: '',
    mapDistances: '',
  });


  const { settings, updateSettings } = useSettings();
  const [contactsForm, setContactsForm] = useState({
    facebook: '',
    instagram: '',
    email: '',
    phone: '',
    whatsapp: '',
    hours: ''
  });

  useEffect(() => {
    if (settings) {
      setContactsForm({
        facebook: settings.facebook || '',
        instagram: settings.instagram || '',
        email: settings.email || '',
        phone: settings.phone || '',
        whatsapp: settings.whatsapp || '',
        hours: settings.hours || ''
      });
    }
  }, [settings, activeTab]);

  const handleContactsSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSettings(contactsForm);
      showFeedback('success', 'Configurações de contatos salvas com sucesso!');
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Erro ao salvar configurações: ' + err.message);
    }
  };

  // Monitora o estado de login no Firebase se configurado
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
        setIsAuthenticating(false);
      });
      return () => unsubscribe();
    } else {
      setIsAuthenticating(false);
    }
  }, []);

  // Carrega as viagens em tempo real
  useEffect(() => {
    if (!isLoggedIn) return;

    if (isFirebaseConfigured && db) {
      setIsLoadingTrips(true);
      const tripsRef = collection(db, 'trips');
      const unsubscribe = onSnapshot(tripsRef, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ docId: doc.id, ...doc.data() });
        });
        setTrips(list);
        setIsLoadingTrips(false);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore:", error);
        setTrips(mockTrips);
        setIsLoadingTrips(false);
      });
      return () => unsubscribe();
    } else {
      setTrips(mockTrips);
    }
  }, [isLoggedIn]);

  // Carrega os depoimentos em tempo real
  useEffect(() => {
    if (!isLoggedIn) return;

    if (isFirebaseConfigured && db) {
      setIsLoadingTestimonials(true);
      const ref = collection(db, 'testimonials');
      const unsubscribe = onSnapshot(ref, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ docId: doc.id, ...doc.data() });
        });
        setTestimonials(list);
        setIsLoadingTestimonials(false);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore (testimonials):", error);
        setTestimonials(mockTestimonials);
        setIsLoadingTestimonials(false);
      });
      return () => unsubscribe();
    } else {
      setTestimonials(mockTestimonials);
    }
  }, [isLoggedIn]);

  // Carrega os destinos em tempo real
  useEffect(() => {
    if (!isLoggedIn) return;

    if (isFirebaseConfigured && db) {
      setIsLoadingDestinations(true);
      const ref = collection(db, 'destinations');
      const unsubscribe = onSnapshot(ref, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ docId: doc.id, ...doc.data() });
        });
        setDestinations(list);
        setIsLoadingDestinations(false);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore (destinations):", error);
        setDestinations(mockDestinations);
        setIsLoadingDestinations(false);
      });
      return () => unsubscribe();
    } else {
      setDestinations(mockDestinations);
    }
  }, [isLoggedIn]);

  // Carrega os momentos em tempo real
  useEffect(() => {
    if (!isLoggedIn) return;

    if (isFirebaseConfigured && db) {
      setIsLoadingMoments(true);
      const ref = collection(db, 'moments');
      const unsubscribe = onSnapshot(ref, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ docId: doc.id, ...doc.data() });
        });
        setMoments(list);
        setIsLoadingMoments(false);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore (moments):", error);
        setMoments([]);
        setIsLoadingMoments(false);
      });
      return () => unsubscribe();
    } else {
      setMoments(mockMoments);
    }
  }, [isLoggedIn]);




  // Simulação/Efetuação de Login Administrativo
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (isFirebaseConfigured && auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setIsLoggedIn(true);
      } catch (err) {
        console.error("Erro no Firebase Auth:", err);
        setLoginError('E-mail ou senha administrativa incorreta.');
      }
    } else {
      // Fallback local caso o Firebase ainda não esteja conectado
      if (password === 'dolce2026') {
        setIsLoggedIn(true);
      } else {
        setLoginError('E-mail ou senha administrativa incorreta.');
      }
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Erro ao deslogar:", err);
      }
    }
    setIsLoggedIn(false);
  };

  // Popular o Banco de Dados com mockTrips, mockTestimonials, mockDestinations e mockMoments
  const handleSeedDatabase = async () => {
    if (!isFirebaseConfigured || !db) return;
    if (window.confirm("Deseja mesmo popular o Firebase Firestore com todos os dados de demonstração (viagens, depoimentos, destinos e momentos)?")) {
      setIsSeeding(true);
      try {
        const batch = writeBatch(db);
        
        // 1. Viagens
        const tripsRef = collection(db, 'trips');
        mockTrips.forEach((trip) => {
          const newDocRef = doc(tripsRef);
          batch.set(newDocRef, {
            id: trip.id,
            title: trip.title,
            country: trip.country,
            duration: trip.duration,
            departure: trip.departure,
            date: trip.date,
            price: trip.price,
            hidePrice: trip.hidePrice || false,
            spotsTotal: trip.spotsTotal,
            spotsLeft: trip.spotsLeft,
            status: trip.status,
            description: trip.description,
            image: trip.image,
            tags: trip.tags || [],
            route: trip.route || [],
            mapImage: trip.mapImage || '',
            mapDistances: trip.mapDistances || '',
            itinerary: trip.itinerary || [
              { day: 1, title: `Chegada em ${trip.title}`, desc: `Traslado privado ao hotel boutique. Jantar especial de boas-vindas.` }
            ]
          });
        });

        // 2. Depoimentos
        const testimonialsRef = collection(db, 'testimonials');
        mockTestimonials.forEach((testimonial) => {
          const newDocRef = doc(testimonialsRef);
          batch.set(newDocRef, {
            id: testimonial.id,
            name: testimonial.name,
            location: testimonial.location,
            trip: testimonial.trip,
            stars: Number(testimonial.stars),
            text: testimonial.text
          });
        });

        // 3. Destinos
        const destinationsRef = collection(db, 'destinations');
        mockDestinations.forEach((dest) => {
          const newDocRef = doc(destinationsRef);
          batch.set(newDocRef, {
            id: dest.id,
            title: dest.title,
            country: dest.country,
            description: dest.description,
            image: dest.image,
            tags: dest.tags || [],
            highlights: dest.highlights || []
          });
        });

        // 4. Momentos
        const momentsRef = collection(db, 'moments');
        mockMoments.forEach((moment) => {
          const newDocRef = doc(momentsRef);
          batch.set(newDocRef, {
            id: moment.id,
            type: moment.type,
            category: moment.category,
            title: moment.title,
            location: moment.location,
            date: moment.date,
            description: moment.description,
            image: moment.image,
            videoUrl: moment.videoUrl || ''
          });
        });
        
        await batch.commit();
        showFeedback('success', "Firestore totalmente populado com sucesso!");
      } catch (err) {
        console.error(err);
        showFeedback('error', "Erro ao popular banco de dados: " + err.message);
      } finally {
        setIsSeeding(false);
      }
    }
  };

  const handleSeedDestinations = async () => {
    if (!isFirebaseConfigured || !db) return;
    if (window.confirm("Deseja popular a coleção de destinos com os dados de demonstração?")) {
      setIsSeeding(true);
      try {
        const batch = writeBatch(db);
        const ref = collection(db, 'destinations');
        mockDestinations.forEach((dest) => {
          const newDocRef = doc(ref);
          batch.set(newDocRef, {
            id: dest.id,
            title: dest.title,
            country: dest.country,
            description: dest.description,
            image: dest.image,
            tags: dest.tags || [],
            highlights: dest.highlights || []
          });
        });
        await batch.commit();
        showFeedback('success', "Destinos de demonstração importados com sucesso!");
      } catch (err) {
        console.error(err);
        showFeedback('error', "Erro ao popular destinos: " + err.message);
      } finally {
        setIsSeeding(false);
      }
    }
  };

  const handleSeedMoments = async () => {
    if (!isFirebaseConfigured || !db) return;
    if (window.confirm("Deseja popular a coleção de Nossos Momentos com as mídias de demonstração?")) {
      setIsSeeding(true);
      try {
        const batch = writeBatch(db);
        const ref = collection(db, 'moments');
        mockMoments.forEach((moment) => {
          const newDocRef = doc(ref);
          batch.set(newDocRef, {
            id: moment.id,
            type: moment.type,
            category: moment.category,
            title: moment.title,
            location: moment.location,
            date: moment.date,
            description: moment.description,
            image: moment.image,
            videoUrl: moment.videoUrl || ''
          });
        });
        await batch.commit();
        showFeedback('success', "Momentos de demonstração importados com sucesso!");
      } catch (err) {
        console.error(err);
        showFeedback('error', "Erro ao popular momentos: " + err.message);
      } finally {
        setIsSeeding(false);
      }
    }
  };



  const formatPrice = (value) => {
    if (!value) return '';
    let clean = value.replace(/\D/g, '');
    if (!clean) return '';
    const number = Number(clean) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(number);
  };

  // CRUD Handlers
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingTripId(null);
    setImageInputMode('url');
    setImageUploadPreview(null);
    setMapImageInputMode('url');
    setMapImageUploadPreview(null);
    setSendPush(false);
    setTripForm({
      title: '',
      country: 'Itália',
      duration: '',
      departure: 'São Paulo/SP',
      date: '',
      price: '',
      hidePrice: false,
      spotsTotal: 12,
      spotsLeft: 12,
      status: 'Ativo',
      description: '',
      included: '',
      image: '',
      tagsString: '',
      routeString: '',
      mapImage: '',
      mapDistances: '',
      videoUrl: '',
      videoTitle: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (trip) => {
    setModalMode('edit');
    setEditingTripId(trip.docId || trip.id);
    setSendPush(false);
    
    let formattedPrice = trip.price || '';
    if (formattedPrice && !formattedPrice.includes(',')) {
      formattedPrice = formatPrice(formattedPrice + ',00');
    } else {
      formattedPrice = formatPrice(formattedPrice);
    }

    setTripForm({
      title: trip.title,
      country: trip.country,
      duration: trip.duration,
      departure: trip.departure,
      date: trip.date,
      price: formattedPrice,
      hidePrice: trip.hidePrice || false,
      spotsTotal: (trip.spotsTotal !== null && trip.spotsTotal !== undefined) ? trip.spotsTotal : '',
      spotsLeft: (trip.spotsLeft !== null && trip.spotsLeft !== undefined) ? trip.spotsLeft : '',
      status: trip.status,
      description: trip.description,
      included: trip.included || '',
      image: trip.image,
      tagsString: (trip.tags || []).join(', '),
      routeString: (trip.route || []).join(', '),
      mapImage: trip.mapImage || '',
      mapDistances: trip.mapDistances || '',
      videoUrl: trip.videoUrl || '',
      videoTitle: trip.videoTitle || '',
    });
    // Detecta automaticamente se a imagem é base64 (upload) ou URL
    const imageIsBase64 = trip.image && trip.image.startsWith('data:');
    setImageInputMode(imageIsBase64 ? 'upload' : 'url');
    setImageUploadPreview(imageIsBase64 ? trip.image : null);

    const mapImageIsBase64 = trip.mapImage && trip.mapImage.startsWith('data:');
    setMapImageInputMode(mapImageIsBase64 ? 'upload' : 'url');
    setMapImageUploadPreview(mapImageIsBase64 ? trip.mapImage : null);
    setIsModalOpen(true);
  };

  const handleDeleteTrip = async (trip) => {
    const tripId = trip.docId || trip.id;
    if (window.confirm(`Tem certeza que deseja excluir a viagem para "${trip.title}" permanentemente?`)) {
      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'trips', tripId));
          showFeedback('success', 'Viagem excluída com sucesso!');
        } catch (err) {
          console.error("Erro ao excluir documento:", err);
          showFeedback('error', "Erro ao excluir do Firestore: " + err.message);
        }
      } else {
        showFeedback('success', "Operação em Modo de Demonstração. Removendo localmente.");
        const idx = mockTrips.findIndex(t => t.id === tripId);
        if (idx !== -1) {
          mockTrips.splice(idx, 1);
          setTrips([...mockTrips]);
        }
      }
    }
  };

  // Dispara notificação push via Vercel Serverless Function
  const triggerPushNotification = async (title, message, imageUrl = null) => {
    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message,
          url: window.location.origin,
          image: imageUrl
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('Notificação push enviada com sucesso:', data);
      } else {
        console.warn('Erro ao enviar push:', data.error);
      }
    } catch (err) {
      console.error('Falha ao conectar com o serviço de notificações:', err);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // Tratamento dos campos de tags e rota
    const tags = tripForm.tagsString.split(',').map(t => t.trim()).filter(t => t !== '');
    const route = tripForm.routeString.split(',').map(r => r.trim()).filter(r => r !== '');
    
    const tripData = {
      title: tripForm.title,
      country: tripForm.country,
      duration: tripForm.duration,
      departure: tripForm.departure,
      date: tripForm.date,
      price: tripForm.price,
      hidePrice: tripForm.hidePrice || false,
      spotsTotal: (tripForm.spotsTotal !== '' && tripForm.spotsTotal !== null && tripForm.spotsTotal !== undefined) ? Number(tripForm.spotsTotal) : null,
      spotsLeft: (tripForm.spotsLeft !== '' && tripForm.spotsLeft !== null && tripForm.spotsLeft !== undefined) ? Number(tripForm.spotsLeft) : null,
      status: tripForm.status,
      description: tripForm.description,
      included: tripForm.included,
      image: tripForm.image || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
      tags,
      route,
      mapImage: tripForm.mapImage || '',
      mapDistances: tripForm.mapDistances || '',
      videoUrl: tripForm.videoUrl || '',
      videoTitle: tripForm.videoTitle || '',
      itinerary: [
        { day: 1, title: `Chegada em ${tripForm.title}`, desc: `Recepção no aeroporto e traslado privativo para o nosso hotel boutique.` },
        { day: 2, title: "Exploração Guiada", desc: "Passeio exclusivo acompanhado de guia local especializado nos segredos da região." }
      ]
    };

    if (isFirebaseConfigured && db) {
      try {
        if (modalMode === 'add') {
          // Slug para o id amigável
          tripData.id = tripForm.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          await addDoc(collection(db, 'trips'), tripData);
          showFeedback('success', 'Nova viagem criada com sucesso!');
          
          if (sendPush) {
            triggerPushNotification(
              "Nova Viagem Disponível! ✈️",
              `Conheça nosso novo roteiro: "${tripForm.title}" (${tripForm.duration}). Vagas limitadas!`,
              tripData.image
            );
          }
        } else {
          // Update
          await updateDoc(doc(db, 'trips', editingTripId), tripData);
          showFeedback('success', 'Viagem atualizada com sucesso!');
          
          if (sendPush) {
            triggerPushNotification(
              "Roteiro Atualizado! ✨",
              `Temos novidades e atualizações no roteiro "${tripForm.title}". Venha conferir!`,
              tripData.image
            );
          }
        }
        setIsModalOpen(false);
        setSendPush(false);
      } catch (err) {
        console.error("Erro ao salvar no banco:", err);
        showFeedback('error', "Erro ao gravar dados no Firebase: " + err.message);
      }
    } else {
      showFeedback('success', "Demonstração local: os dados foram atualizados temporariamente.");
      if (modalMode === 'add') {
        const newLocalTrip = {
          id: 'local-' + Date.now(),
          ...tripData
        };
        mockTrips.push(newLocalTrip);
        setTrips([...mockTrips]);
        
        if (sendPush) {
          triggerPushNotification(
            "Nova Viagem Disponível! ✈️ (Demo Local)",
            `Conheça nosso novo roteiro: "${tripForm.title}" (${tripForm.duration}). Vagas limitadas!`
          );
        }
      } else {
        const idx = mockTrips.findIndex(t => t.id === editingTripId);
        if (idx !== -1) {
          mockTrips[idx] = {
            ...mockTrips[idx],
            ...tripData
          };
          setTrips([...mockTrips]);
        }
        
        if (sendPush) {
          triggerPushNotification(
            "Roteiro Atualizado! ✨ (Demo Local)",
            `Temos novidades e atualizações no roteiro "${tripForm.title}". Venha conferir!`
          );
        }
      }
      setIsModalOpen(false);
      setSendPush(false);
    }
  };

  // CRUD Handlers for Testimonials
  const handleOpenAddTestimonialModal = () => {
    setTestimonialModalMode('add');
    setEditingTestimonialId(null);
    setTestimonialForm({
      name: '',
      location: '',
      trip: '',
      stars: 5,
      text: ''
    });
    setIsTestimonialModalOpen(true);
  };

  const handleOpenEditTestimonialModal = (testimonial) => {
    setTestimonialModalMode('edit');
    setEditingTestimonialId(testimonial.docId || testimonial.id);
    setTestimonialForm({
      name: testimonial.name,
      location: testimonial.location,
      trip: testimonial.trip,
      stars: testimonial.stars,
      text: testimonial.text
    });
    setIsTestimonialModalOpen(true);
  };

  const handleDeleteTestimonial = async (testimonial) => {
    const testimonialId = testimonial.docId || testimonial.id;
    if (window.confirm(`Tem certeza que deseja excluir o depoimento de "${testimonial.name}" permanentemente?`)) {
      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'testimonials', testimonialId));
          showFeedback('success', 'Depoimento excluído com sucesso!');
        } catch (err) {
          console.error("Erro ao excluir depoimento:", err);
          showFeedback('error', "Erro ao excluir do Firestore: " + err.message);
        }
      } else {
        showFeedback('success', "Operação em Modo de Demonstração. Removendo localmente.");
        const idx = mockTestimonials.findIndex(t => t.id === testimonialId);
        if (idx !== -1) {
          mockTestimonials.splice(idx, 1);
          setTestimonials([...mockTestimonials]);
        }
      }
    }
  };

  const handleTestimonialFormSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: testimonialForm.name,
      location: testimonialForm.location,
      trip: testimonialForm.trip,
      stars: Number(testimonialForm.stars),
      text: testimonialForm.text
    };

    if (isFirebaseConfigured && db) {
      try {
        if (testimonialModalMode === 'add') {
          await addDoc(collection(db, 'testimonials'), data);
          showFeedback('success', 'Novo depoimento cadastrado com sucesso!');
        } else {
          await updateDoc(doc(db, 'testimonials', editingTestimonialId), data);
          showFeedback('success', 'Depoimento atualizado com sucesso!');
        }
        setIsTestimonialModalOpen(false);
      } catch (err) {
        console.error("Erro ao salvar depoimento:", err);
        showFeedback('error', "Erro ao gravar dados no Firebase: " + err.message);
      }
    } else {
      showFeedback('success', "Demonstração local: depoimento atualizado temporariamente.");
      if (testimonialModalMode === 'add') {
        const newLocal = {
          id: 'local-test-' + Date.now(),
          ...data
        };
        mockTestimonials.push(newLocal);
        setTestimonials([...mockTestimonials]);
      } else {
        const idx = mockTestimonials.findIndex(t => t.id === editingTestimonialId);
        if (idx !== -1) {
          mockTestimonials[idx] = {
            ...mockTestimonials[idx],
            ...data
          };
          setTestimonials([...mockTestimonials]);
        }
      }
      setIsTestimonialModalOpen(false);
    }
  };

  // CRUD Handlers for Destinations
  const handleOpenAddDestinationModal = () => {
    setDestinationModalMode('add');
    setEditingDestinationId(null);
    setImageInputMode('url');
    setImageUploadPreview(null);
    setDestinationForm({
      title: '',
      country: 'Itália',
      description: '',
      image: '',
      tagsString: '',
      highlightsString: ''
    });
    setIsDestinationModalOpen(true);
  };

  const handleOpenEditDestinationModal = (dest) => {
    setDestinationModalMode('edit');
    setEditingDestinationId(dest.docId || dest.id);
    setDestinationForm({
      title: dest.title || '',
      country: dest.country || 'Itália',
      description: dest.description || '',
      image: dest.image || '',
      tagsString: (dest.tags || []).join(', '),
      highlightsString: (dest.highlights || []).join(', ')
    });
    const imageIsBase64 = dest.image && dest.image.startsWith('data:');
    setImageInputMode(imageIsBase64 ? 'upload' : 'url');
    setImageUploadPreview(imageIsBase64 ? dest.image : null);
    setIsDestinationModalOpen(true);
  };

  const handleDeleteDestination = async (dest) => {
    const destId = dest.docId || dest.id;
    if (window.confirm(`Tem certeza que deseja excluir o destino "${dest.title}" permanentemente?`)) {
      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'destinations', destId));
          showFeedback('success', 'Destino excluído com sucesso!');
        } catch (err) {
          console.error("Erro ao excluir destino:", err);
          showFeedback('error', "Erro ao excluir do Firestore: " + err.message);
        }
      } else {
        showFeedback('success', "Operação em Modo de Demonstração. Removendo localmente.");
        const idx = mockDestinations.findIndex(d => d.id === destId);
        if (idx !== -1) {
          mockDestinations.splice(idx, 1);
          setDestinations([...mockDestinations]);
        }
      }
    }
  };

  const handleDestinationFormSubmit = async (e) => {
    e.preventDefault();
    const tags = destinationForm.tagsString
      ? destinationForm.tagsString.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const highlights = destinationForm.highlightsString
      ? destinationForm.highlightsString.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const destData = {
      title: destinationForm.title,
      country: destinationForm.country,
      description: destinationForm.description,
      image: destinationForm.image,
      tags,
      highlights
    };

    if (isFirebaseConfigured && db) {
      try {
        if (destinationModalMode === 'add') {
          await addDoc(collection(db, 'destinations'), destData);
          showFeedback('success', 'Novo destino cadastrado com sucesso!');
        } else {
          await updateDoc(doc(db, 'destinations', editingDestinationId), destData);
          showFeedback('success', 'Destino atualizado com sucesso!');
        }
        setIsDestinationModalOpen(false);
      } catch (err) {
        console.error("Erro ao salvar destino:", err);
        showFeedback('error', "Erro ao gravar dados no Firebase: " + err.message);
      }
    } else {
      showFeedback('success', "Demonstração local: os dados foram atualizados temporariamente.");
      if (destinationModalMode === 'add') {
        const newLocalDest = {
          id: 'local-dest-' + Date.now(),
          ...destData
        };
        mockDestinations.push(newLocalDest);
        setDestinations([...mockDestinations]);
      } else {
        const idx = mockDestinations.findIndex(d => d.id === editingDestinationId);
        if (idx !== -1) {
          mockDestinations[idx] = {
            ...mockDestinations[idx],
            ...destData
          };
          setDestinations([...mockDestinations]);
        }
      }
      setIsDestinationModalOpen(false);
    }
  };

  // CRUD Handlers for Moments
  const handleOpenAddMomentModal = () => {
    setMomentModalMode('add');
    setEditingMomentId(null);
    setImageInputMode('url');
    setImageUploadPreview(null);
    setMomentForm({
      type: 'photo',
      category: 'Itália',
      title: '',
      location: '',
      date: '',
      description: '',
      image: '',
      videoUrl: ''
    });
    setIsMomentModalOpen(true);
  };

  const handleOpenEditMomentModal = (moment) => {
    setMomentModalMode('edit');
    setEditingMomentId(moment.docId || moment.id);
    setMomentForm({
      type: moment.type || 'photo',
      category: moment.category || 'Experiências',
      title: moment.title || '',
      location: moment.location || '',
      date: moment.date || '',
      description: moment.description || '',
      image: moment.image || '',
      videoUrl: moment.videoUrl || ''
    });
    const imageIsBase64 = moment.image && moment.image.startsWith('data:');
    setImageInputMode(imageIsBase64 ? 'upload' : 'url');
    setImageUploadPreview(imageIsBase64 ? moment.image : null);
    setIsMomentModalOpen(true);
  };

  const handleDeleteMoment = async (moment) => {
    const momentId = moment.docId || moment.id;
    if (window.confirm(`Tem certeza que deseja excluir o momento "${moment.title}" permanentemente?`)) {
      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'moments', momentId));
          showFeedback('success', 'Momento excluído com sucesso!');
        } catch (err) {
          console.error("Erro ao excluir momento:", err);
          showFeedback('error', "Erro ao excluir do Firestore: " + err.message);
        }
      } else {
        showFeedback('success', "Operação em Modo de Demonstração. Removendo localmente.");
        const idx = mockMoments.findIndex(m => m.id === momentId);
        if (idx !== -1) {
          mockMoments.splice(idx, 1);
          setMoments([...mockMoments]);
        }
      }
    }
  };

  const handleMomentFormSubmit = async (e) => {
    e.preventDefault();
    const data = {
      type: momentForm.type,
      category: momentForm.category,
      title: momentForm.title,
      location: momentForm.location,
      date: momentForm.date,
      description: momentForm.description,
      image: momentForm.image,
      videoUrl: momentForm.type === 'video' ? momentForm.videoUrl : ''
    };

    if (isFirebaseConfigured && db) {
      try {
        if (momentModalMode === 'add') {
          await addDoc(collection(db, 'moments'), data);
          showFeedback('success', 'Novo momento cadastrado com sucesso!');
        } else {
          await updateDoc(doc(db, 'moments', editingMomentId), data);
          showFeedback('success', 'Momento atualizado com sucesso!');
        }
        setIsMomentModalOpen(false);
      } catch (err) {
        console.error("Erro ao salvar momento:", err);
        showFeedback('error', "Erro ao gravar dados no Firebase: " + err.message);
      }
    } else {
      showFeedback('success', "Demonstração local: os dados foram atualizados temporariamente.");
      if (momentModalMode === 'add') {
        const newLocal = {
          id: 'local-moment-' + Date.now(),
          ...data
        };
        mockMoments.push(newLocal);
        setMoments([...mockMoments]);
      } else {
        const idx = mockMoments.findIndex(m => m.id === editingMomentId);
        if (idx !== -1) {
          mockMoments[idx] = {
            ...mockMoments[idx],
            ...data
          };
          setMoments([...mockMoments]);
        }
      }
      setIsMomentModalOpen(false);
    }
  };

  const maskApiKey = (key) => {
    if (!key || key === "YOUR_API_KEY_HERE") return "Não configurado";
    return key.substring(0, 6) + "..." + key.substring(key.length - 4);
  };

  if (isAuthenticating) {
    return (
      <div className="admin-loading-screen">
        <RefreshCw className="spinner-icon" size={36} />
        <p>Verificando credenciais seguras...</p>
      </div>
    );
  }

  return (
    <div className="admin-page-container container animate-fade-in">
      {/* 1. ESTADO NÃO LOGADO: Tela de Login */}
      {!isLoggedIn ? (
        <div className="login-card-container">
          <div className="login-card glass-card">
            <div className="login-header text-center">
              <div className="admin-shield-icon"><Shield size={28} /></div>
              <h2>Painel de Controle</h2>
              <p>Acesso restrito para administradores da La Dolce Vita</p>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              {loginError && <div className="login-error-msg"><AlertCircle size={16} style={{ marginRight: '6px' }} />{loginError}</div>}
              
              <div className="form-group-custom">
                <label htmlFor="admin-pass">Senha de Acesso</label>
                <div className="input-wrapper">
                  <Key size={16} className="input-icon" />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    id="admin-pass"
                    placeholder="Digite a senha..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button" 
                    className="toggle-pass-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full login-submit-btn" style={{ width: '100%', marginTop: '20px' }}>
                Entrar no Painel
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* 2. ESTADO LOGADO: Dashboard */
        <div className="dashboard-layout">
          {/* Sidebar */}
          <aside className="dashboard-sidebar glass-card">
            <div className="sidebar-profile">
              <div className="profile-avatar">A</div>
              <div>
                <h4>Administrador</h4>
                <span>{isFirebaseConfigured ? 'Acesso Seguro' : 'Acesso Geral'}</span>
              </div>
            </div>

            <nav className="sidebar-nav">
              <button 
                className={`sidebar-nav-btn ${activeTab === 'trips' ? 'active' : ''}`}
                onClick={() => setActiveTab('trips')}
              >
                <LayoutDashboard size={18} />
                <span>Gerenciar Viagens</span>
              </button>

              <button 
                className={`sidebar-nav-btn ${activeTab === 'contacts' ? 'active' : ''}`}
                onClick={() => setActiveTab('contacts')}
              >
                <Settings size={18} />
                <span>Redes & Contatos</span>
              </button>

              <button 
                className={`sidebar-nav-btn ${activeTab === 'testimonials' ? 'active' : ''}`}
                onClick={() => setActiveTab('testimonials')}
              >
                <MessageSquare size={18} />
                <span>Gerenciar Depoimentos</span>
              </button>

              <button 
                className={`sidebar-nav-btn ${activeTab === 'destinations' ? 'active' : ''}`}
                onClick={() => setActiveTab('destinations')}
              >
                <Globe size={18} />
                <span>Gerenciar Destinos</span>
              </button>

              <button 
                className={`sidebar-nav-btn ${activeTab === 'moments' ? 'active' : ''}`}
                onClick={() => setActiveTab('moments')}
              >
                <Camera size={18} />
                <span>Nossos Momentos</span>
              </button>
            </nav>

            <button onClick={handleLogout} className="btn-logout-sidebar">
              <LogOut size={16} style={{ marginRight: '8px' }} />
              <span>Sair do Panel</span>
            </button>
          </aside>

          {/* Painel Principal */}
          <main className="dashboard-panel glass-card">
            {activeTab === 'trips' ? (
              <div className="panel-tab-content">
                <div className="panel-header-row">
                  <div>
                    <h2>Minhas Viagens</h2>
                    <p>Adicione, edite ou remova os pacotes turísticos exibidos no site</p>
                  </div>
                  <button className="btn btn-primary btn-with-icon" onClick={handleOpenAddModal}>
                    <PlusCircle size={16} style={{ marginRight: '8px' }} />
                    <span>Adicionar Nova</span>
                  </button>
                </div>

                {isLoadingTrips ? (
                  <div className="panel-loading">
                    <RefreshCw className="spinner-icon" size={28} />
                    <p>Carregando roteiros...</p>
                  </div>
                ) : (
                  <div className="admin-trips-list">
                    {trips.length === 0 ? (
                      <div className="no-trips-card text-center">
                        <AlertCircle size={32} style={{ color: 'var(--color-primary-gold)', marginBottom: '12px' }} />
                        <h3>Nenhuma viagem encontrada no banco</h3>
                        <p>O Firestore está conectado, mas a coleção está vazia.</p>
                        {isFirebaseConfigured && (
                          <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleSeedDatabase} disabled={isSeeding}>
                            {isSeeding ? 'Populando banco...' : 'Popular com dados de demonstração'}
                          </button>
                        )}
                      </div>
                    ) : (
                      trips.map(trip => (
                        <div key={trip.docId || trip.id} className="admin-trip-row">
                          <img src={trip.image} alt={trip.title} className="trip-row-thumb" />
                          
                          <div className="trip-row-details">
                            <h4>{trip.title}</h4>
                            <span>{trip.country} | {trip.duration} | {trip.date}</span>
                          </div>

                          <div className="trip-row-badges">
                            <span className={`status-badge-admin status-${trip.status.toLowerCase().replace(/\s+/g, '-')}`}>{trip.status}</span>
                          </div>

                          <div className="trip-row-actions">
                            <button className="row-action-btn edit" onClick={() => handleOpenEditModal(trip)} title="Editar">
                              <Edit2 size={15} />
                              <span>Editar</span>
                            </button>
                            <button className="row-action-btn delete" onClick={() => handleDeleteTrip(trip)} title="Excluir">
                              <Trash2 size={15} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : activeTab === 'contacts' ? (
              /* TAB: REDES & CONTATOS */
              <div className="panel-tab-content">
                <div className="panel-header-row">
                  <div>
                    <h2>Redes Sociais & Contatos</h2>
                    <p>Atualize as informações de telefone, e-mail, redes sociais e funcionamento</p>
                  </div>
                </div>

                <form onSubmit={handleContactsSubmit} className="config-form-setup-container">
                  <div className="config-cards-grid">
                    {/* Bloco 1: Canais de Contato */}
                    <div className="config-card-section glass-card">
                      <div className="section-title-wrapper">
                        <Mail className="section-icon" size={18} />
                        <h3>Dados de Atendimento & Contato</h3>
                      </div>
                      <div className="section-fields">
                        <div className="form-group-custom">
                          <label>E-mail de Atendimento</label>
                          <input 
                            type="email" 
                            value={contactsForm.email} 
                            onChange={e => setContactsForm({...contactsForm, email: e.target.value})} 
                            placeholder="ex: contato@ladolcevitaviagens.com.br"
                            required 
                          />
                        </div>

                        <div className="form-group-custom">
                          <label>Telefone Formatado (Exibido no Site)</label>
                          <input 
                            type="text" 
                            value={contactsForm.phone} 
                            onChange={e => setContactsForm({...contactsForm, phone: e.target.value})} 
                            placeholder="ex: (14) 99999-9999"
                            required 
                          />
                        </div>

                        <div className="form-group-custom">
                          <label>WhatsApp (Link Direto - Apenas Números)</label>
                          <input 
                            type="text" 
                            value={contactsForm.whatsapp} 
                            onChange={e => setContactsForm({...contactsForm, whatsapp: e.target.value.replace(/\D/g, '')})} 
                            placeholder="ex: 5514999999999"
                            required 
                          />
                          <small className="field-tip">Código do País + DDD + Número (ex: 5514999999999)</small>
                        </div>

                        <div className="form-group-custom">
                          <label>Horário de Atendimento</label>
                          <input 
                            type="text" 
                            value={contactsForm.hours} 
                            onChange={e => setContactsForm({...contactsForm, hours: e.target.value})} 
                            placeholder="ex: Seg - Sex: 09h às 18h"
                            required 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Redes Sociais */}
                    <div className="config-card-section glass-card">
                      <div className="section-title-wrapper">
                        <Settings className="section-icon" size={18} />
                        <h3>Canais de Redes Sociais</h3>
                      </div>
                      <div className="section-fields">
                        <div className="form-group-custom">
                          <label>Link do Instagram</label>
                          <input 
                            type="url" 
                            value={contactsForm.instagram} 
                            onChange={e => setContactsForm({...contactsForm, instagram: e.target.value})} 
                            placeholder="ex: https://www.instagram.com/nomedousuario/"
                            required 
                          />
                        </div>

                        <div className="form-group-custom">
                          <label>Link do Facebook</label>
                          <input 
                            type="url" 
                            value={contactsForm.facebook} 
                            onChange={e => setContactsForm({...contactsForm, facebook: e.target.value})} 
                            placeholder="ex: https://facebook.com/nomedapagina"
                            required 
                          />
                        </div>
                        
                        <div className="config-help-notice">
                          <AlertCircle size={16} className="notice-icon" />
                          <p>Estas configurações atualizam instantaneamente o Header, o Footer, a Página de Contato e os botões flutuantes de WhatsApp em todo o site.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-submit-row">
                    <button type="submit" className="btn btn-primary btn-with-icon">
                      <CheckCircle size={16} style={{ marginRight: '8px' }} />
                      <span>Salvar Configurações</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : activeTab === 'testimonials' ? (
              /* TAB: TESTIMONIALS */
              <div className="panel-tab-content">
                <div className="panel-header-row">
                  <div>
                    <h2>Depoimentos de Viajantes</h2>
                    <p>Gerencie o carrossel de depoimentos reais exibido na página inicial</p>
                  </div>
                  <button className="btn btn-primary btn-with-icon" onClick={handleOpenAddTestimonialModal}>
                    <PlusCircle size={16} style={{ marginRight: '8px' }} />
                    <span>Adicionar Depoimento</span>
                  </button>
                </div>

                {isLoadingTestimonials ? (
                  <div className="panel-loading">
                    <RefreshCw className="spinner-icon" size={28} />
                    <p>Carregando depoimentos...</p>
                  </div>
                ) : (
                  <div className="admin-trips-list">
                    {testimonials.length === 0 ? (
                      <div className="no-trips-card text-center">
                        <AlertCircle size={32} style={{ color: 'var(--color-primary-gold)', marginBottom: '12px' }} />
                        <h3>Nenhum depoimento encontrado</h3>
                        <p>A coleção de depoimentos no Firestore está vazia. Você pode popular com dados iniciais.</p>
                      </div>
                    ) : (
                      testimonials.map(testimonial => (
                        <div key={testimonial.docId || testimonial.id} className="admin-trip-row admin-testimonial-row">
                          <div className="profile-avatar" style={{ width: '40px', height: '40px', fontSize: '0.9rem' }}>
                            {testimonial.name.substring(0, 2).toUpperCase()}
                          </div>
                          
                          <div className="trip-row-details">
                            <h4>{testimonial.name}</h4>
                            <span>{testimonial.location} | Viagem: {testimonial.trip}</span>
                          </div>

                          <div className="trip-row-badges">
                            <span className="status-badge-admin status-ativo" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {testimonial.stars} ★
                            </span>
                          </div>

                          <div className="trip-row-actions">
                            <button className="row-action-btn edit" onClick={() => handleOpenEditTestimonialModal(testimonial)} title="Editar">
                              <Edit2 size={15} />
                              <span>Editar</span>
                            </button>
                            <button className="row-action-btn delete" onClick={() => handleDeleteTestimonial(testimonial)} title="Excluir">
                              <Trash2 size={15} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : activeTab === 'destinations' ? (
              /* TAB: GERENCIAR DESTINOS */
              <div className="panel-tab-content">
                <div className="panel-header-row">
                  <div>
                    <h2>Gerenciar Destinos</h2>
                    <p>Adicione, edite e organize os destinos exibidos na página pública de Destinos</p>
                  </div>
                  <button className="btn btn-primary btn-with-icon" onClick={handleOpenAddDestinationModal}>
                    <PlusCircle size={16} style={{ marginRight: '8px' }} />
                    <span>Adicionar Destino</span>
                  </button>
                </div>

                {/* Contadores por país */}
                {destinations.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', marginRight: '4px' }}>Destinos por país:</span>
                    {[...new Set(destinations.map(d => d.country))].sort().map(c => (
                      <span key={c} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', background: 'var(--color-bg-cream)', color: 'var(--color-dark-green)', border: '1px solid var(--glass-border)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Globe size={11} />
                        {c} <strong style={{ color: 'var(--color-primary-gold-dark)' }}>({destinations.filter(d => d.country === c).length})</strong>
                      </span>
                    ))}
                  </div>
                )}

                {isLoadingDestinations ? (
                  <div className="panel-loading">
                    <RefreshCw className="spinner-icon" size={28} />
                    <p>Carregando destinos...</p>
                  </div>
                ) : destinations.length === 0 ? (
                  <div className="no-trips-card text-center">
                    <Globe size={32} style={{ color: 'var(--color-primary-gold)', marginBottom: '12px' }} />
                    <h3>Nenhum destino cadastrado</h3>
                    <p>Clique em "Adicionar Destino" para criar o primeiro destino.</p>
                    {isFirebaseConfigured && (
                      <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleSeedDestinations} disabled={isSeeding}>
                        {isSeeding ? 'Populando banco...' : 'Popular com dados de demonstração'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="destinations-admin-grid">
                    {destinations.map(dest => {
                      return (
                        <div key={dest.docId || dest.id} className="destination-admin-card glass-card">
                          {/* Imagem do destino */}
                          <div className="dest-card-image-wrapper">
                            {dest.image ? (
                              <img src={dest.image} alt={dest.title} className="dest-card-image" />
                            ) : (
                              <div className="dest-card-image-placeholder">
                                <Globe size={28} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="dest-card-body">
                            <div className="dest-card-country">
                              <MapPin size={11} />
                              <span>{dest.country}</span>
                            </div>
                            <h4 className="dest-card-title">{dest.title}</h4>
                            <p className="dest-card-desc">{(dest.description || '').substring(0, 70)}{dest.description?.length > 70 ? '...' : ''}</p>
                            {dest.tags && dest.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                                {dest.tags.slice(0, 3).map((tag, i) => (
                                  <span key={i} style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--color-bg-cream)', borderRadius: '3px', color: 'var(--color-primary-gold-dark)', fontWeight: '600' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="dest-card-actions">
                            <button
                              className="row-action-btn edit"
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => handleOpenEditDestinationModal(dest)}
                            >
                              <Edit2 size={14} />
                              <span>Editar</span>
                            </button>
                            <button
                              className="row-action-btn delete"
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => handleDeleteDestination(dest)}
                            >
                              <Trash2 size={14} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'moments' ? (
              /* TAB: GERENCIAR MOMENTOS */
              <div className="panel-tab-content">
                <div className="panel-header-row">
                  <div>
                    <h2>Nossos Momentos</h2>
                    <p>Adicione fotos e vídeos das viagens passadas e depoimentos visuais dos clientes</p>
                  </div>
                  <button className="btn btn-primary btn-with-icon" onClick={handleOpenAddMomentModal}>
                    <PlusCircle size={16} style={{ marginRight: '8px' }} />
                    <span>Adicionar Registro</span>
                  </button>
                </div>

                {/* Contadores por categoria */}
                {moments.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', marginRight: '4px' }}>Mídias por categoria:</span>
                    {['Itália', 'Portugal', 'Experiências'].map(cat => (
                      <span key={cat} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', background: 'var(--color-bg-cream)', color: 'var(--color-dark-green)', border: '1px solid var(--glass-border)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Globe size={11} />
                        {cat} <strong style={{ color: 'var(--color-primary-gold-dark)' }}>({moments.filter(m => m.category === cat).length})</strong>
                      </span>
                    ))}
                  </div>
                )}

                {isLoadingMoments ? (
                  <div className="panel-loading">
                    <RefreshCw className="spinner-icon" size={28} />
                    <p>Carregando galeria...</p>
                  </div>
                ) : moments.length === 0 ? (
                  <div className="no-trips-card text-center">
                    <Camera size={32} style={{ color: 'var(--color-primary-gold)', marginBottom: '12px' }} />
                    <h3>Nenhum momento cadastrado</h3>
                    <p>Clique em "Adicionar Registro" para postar a primeira foto ou vídeo.</p>
                    {isFirebaseConfigured && (
                      <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleSeedMoments} disabled={isSeeding}>
                        {isSeeding ? 'Populando banco...' : 'Popular com dados de demonstração'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="destinations-admin-grid">
                    {moments.map(moment => {
                      return (
                        <div key={moment.docId || moment.id} className="destination-admin-card glass-card">
                          {/* Imagem/Thumb */}
                          <div className="dest-card-image-wrapper">
                            {moment.image ? (
                              <img src={moment.image} alt={moment.title} className="dest-card-image" />
                            ) : (
                              <div className="dest-card-image-placeholder">
                                <Camera size={28} />
                              </div>
                            )}
                            <span className="dest-status-badge status-badge-admin status-ativo" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {moment.type === 'video' ? '📹 Vídeo' : '📷 Foto'}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="dest-card-body">
                            {moment.location && (
                              <div className="dest-card-country">
                                <MapPin size={11} />
                                <span>{moment.location}</span>
                              </div>
                            )}
                            <h4 className="dest-card-title">{moment.title || 'Sem Título'}</h4>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-primary-gold-dark)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                              {moment.category}
                            </span>
                            {moment.description && (
                              <p className="dest-card-desc">{(moment.description || '').substring(0, 70)}{moment.description?.length > 70 ? '...' : ''}</p>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="dest-card-actions">
                            <button
                              className="row-action-btn edit"
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => handleOpenEditMomentModal(moment)}
                            >
                              <Edit2 size={14} />
                              <span>Editar</span>
                            </button>
                            <button
                              className="row-action-btn delete"
                              style={{ flex: 1, justifyContent: 'center' }}
                              onClick={() => handleDeleteMoment(moment)}
                            >
                              <Trash2 size={14} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </main>
        </div>
      )}

      {/* 3. MODAL DE ADICIONAR / EDITAR VIAGEM (Layout Duas Colunas Premium) */}
      {isModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card glass-card">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Adicionar Novo Roteiro' : 'Editar Roteiro'}</h3>
              <button className="close-modal-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-form-grid">
              {/* Coluna da Esquerda */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label>Título do Destino</label>
                  <input 
                    type="text" 
                    value={tripForm.title} 
                    onChange={e => setTripForm({...tripForm, title: e.target.value})} 
                    placeholder="Ex: Toscana e Vinhos" 
                    required 
                  />
                </div>

                <div className="form-row-two-col">
                  <div className="form-group-custom">
                    <label>País</label>
                    <input 
                      type="text" 
                      value={tripForm.country} 
                      onChange={e => setTripForm({...tripForm, country: e.target.value})} 
                      placeholder="Ex: Itália, Norte da Europa..." 
                      required 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>Duração</label>
                    <input 
                      type="text" 
                      value={tripForm.duration} 
                      onChange={e => setTripForm({...tripForm, duration: e.target.value})} 
                      placeholder="Ex: 8 Dias" 
                      required 
                    />
                  </div>
                </div>

                <div className="form-row-two-col">
                  <div className="form-group-custom">
                    <label>Preço</label>
                    <input 
                      type="text" 
                      value={tripForm.price} 
                      onChange={e => setTripForm({...tripForm, price: formatPrice(e.target.value)})} 
                      placeholder={tripForm.hidePrice ? "Consulte o valor" : "R$ 0,00"} 
                      required={!tripForm.hidePrice}
                      disabled={tripForm.hidePrice}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <input 
                        type="checkbox" 
                        id="trip-hide-price"
                        checked={tripForm.hidePrice || false}
                        onChange={e => {
                          const checked = e.target.checked;
                          setTripForm(prev => ({
                            ...prev,
                            hidePrice: checked,
                            price: checked ? '' : prev.price
                          }));
                        }}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                      />
                      <label htmlFor="trip-hide-price" style={{ margin: 0, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: 'var(--color-dark-green)' }}>
                        Ocultar preço (Exibir "Consulte o valor")
                      </label>
                    </div>
                  </div>

                  <div className="form-group-custom">
                    <label>Data de Saída</label>
                    <input 
                      type="text" 
                      value={tripForm.date} 
                      onChange={e => setTripForm({...tripForm, date: e.target.value})} 
                      placeholder="Ex: Setembro de 2026" 
                      required 
                    />
                  </div>
                </div>

                <div className="form-row-three-col">
                  <div className="form-group-custom">
                    <label>Vagas Totais</label>
                    <input 
                      type="number" 
                      value={tripForm.spotsTotal} 
                      onChange={e => setTripForm({...tripForm, spotsTotal: e.target.value})} 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>Vagas Livres</label>
                    <input 
                      type="number" 
                      value={tripForm.spotsLeft} 
                      onChange={e => setTripForm({...tripForm, spotsLeft: e.target.value})} 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>Status</label>
                    <select 
                      value={tripForm.status} 
                      onChange={e => setTripForm({...tripForm, status: e.target.value})}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Vagas Limitadas">Vagas Limitadas</option>
                      <option value="Esgotado">Esgotado</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group-custom">
                  <label>Ponto de Embarque / Saída</label>
                  <input 
                    type="text" 
                    value={tripForm.departure} 
                    onChange={e => setTripForm({...tripForm, departure: e.target.value})} 
                    placeholder="Ex: São Paulo/SP" 
                    required 
                  />
                </div>
              </div>

              {/* Coluna da Direita */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span>Imagem de Capa</span>
                    {/* Toggle URL / Upload */}
                    <div style={{ display: 'flex', background: 'var(--color-bg-cream)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => { setImageInputMode('url'); setImageUploadPreview(null); }}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'url' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'url' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        🔗 URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMode('upload')}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'upload' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'upload' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        📁 Upload
                      </button>
                    </div>
                  </label>

                  {imageInputMode === 'url' ? (
                    <input
                      type="url"
                      value={tripForm.image && !tripForm.image.startsWith('data:') ? tripForm.image : ''}
                      onChange={e => setTripForm({...tripForm, image: e.target.value})}
                      placeholder="https://images.unsplash.com/..."
                    />
                  ) : (
                    <div>
                      <label
                        htmlFor="image-upload-input"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '2px dashed var(--glass-border)', borderRadius: '8px', padding: '20px',
                          cursor: 'pointer', background: 'var(--color-bg-cream)', transition: 'border-color 0.2s',
                          gap: '8px'
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const file = e.dataTransfer.files[0];
                          if (file) handleImageFileChange({ target: { files: [file] } });
                        }}
                      >
                        {imageUploadPreview || (tripForm.image && tripForm.image.startsWith('data:')) ? (
                          <img
                            src={imageUploadPreview || tripForm.image}
                            alt="preview"
                            style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📷</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-dark-green)' }}>Clique para escolher ou arraste aqui</span>
                            <br/>
                            <span style={{ fontSize: '0.72rem' }}>JPG, PNG, WebP — máx. 15MB (otimizada automaticamente)</span>
                          </div>
                        )}
                        <input
                          id="image-upload-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleImageFileChange}
                        />
                      </label>
                      {(imageUploadPreview || (tripForm.image && tripForm.image.startsWith('data:'))) && (
                        <button
                          type="button"
                          style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setImageUploadPreview(null); setTripForm(prev => ({...prev, image: ''})); }}
                        >
                          ✕ Remover imagem
                        </button>
                      )}
                    </div>
                  )}

                  {/* Preview quando URL digitada */}
                  {imageInputMode === 'url' && tripForm.image && !tripForm.image.startsWith('data:') && (
                    <img
                      src={tripForm.image}
                      alt="preview"
                      style={{ marginTop: '8px', width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="form-group-custom">
                  <label>Tags de Destaque (separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={tripForm.tagsString} 
                    onChange={e => setTripForm({...tripForm, tagsString: e.target.value})} 
                    placeholder="Ex: Luxo, Vinhos, Gastronomia" 
                  />
                </div>

                <div className="form-group-custom">
                  <label>Cidades do Roteiro (separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={tripForm.routeString} 
                    onChange={e => setTripForm({...tripForm, routeString: e.target.value})} 
                    placeholder="Ex: Florença, Siena, Pisa, Lucca" 
                  />
                </div>

                {/* CONFIGURAÇÃO DO MAPA DO ROTEIRO */}
                <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '15px', marginTop: '15px' }}>
                  <h4 style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary-gold-dark)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Mapa e Distâncias do Roteiro
                  </h4>
                  
                  <div className="form-group-custom">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span>Imagem do Mapa do Roteiro (Opcional)</span>
                      {/* Toggle URL / Upload para o Mapa */}
                      <div style={{ display: 'flex', background: 'var(--color-bg-cream)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => { setMapImageInputMode('url'); setMapImageUploadPreview(null); }}
                          style={{
                            padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                            background: mapImageInputMode === 'url' ? 'var(--color-dark-green)' : 'transparent',
                            color: mapImageInputMode === 'url' ? '#fff' : 'var(--color-text-muted)',
                            transition: 'all 0.2s'
                          }}
                        >
                          🔗 URL
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMapImageInputMode('upload'); setMapImageUploadPreview(null); }}
                          style={{
                            padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                            background: mapImageInputMode === 'upload' ? 'var(--color-dark-green)' : 'transparent',
                            color: mapImageInputMode === 'upload' ? '#fff' : 'var(--color-text-muted)',
                            transition: 'all 0.2s'
                          }}
                        >
                          📁 Upload
                        </button>
                      </div>
                    </label>

                    {mapImageInputMode === 'url' ? (
                      <input
                        type="url"
                        value={tripForm.mapImage && !tripForm.mapImage.startsWith('data:') ? tripForm.mapImage : ''}
                        onChange={e => setTripForm({...tripForm, mapImage: e.target.value})}
                        placeholder="https://images.unsplash.com/... ou print do mapa"
                      />
                    ) : (
                      <div>
                        <label
                          htmlFor="map-image-upload-input"
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            border: '2px dashed var(--glass-border)', borderRadius: '8px', padding: '20px',
                            cursor: 'pointer', background: 'var(--color-bg-cream)', transition: 'border-color 0.2s',
                            gap: '8px'
                          }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleImageFileChange({ target: { files: [file] } }, 'tripMap');
                          }}
                        >
                          {mapImageUploadPreview || (tripForm.mapImage && tripForm.mapImage.startsWith('data:')) ? (
                            <img
                              src={mapImageUploadPreview || tripForm.mapImage}
                              alt="preview do mapa"
                              style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                            />
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🗺️</div>
                              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-dark-green)' }}>Clique para escolher ou arraste o print do mapa</span>
                              <br/>
                              <span style={{ fontSize: '0.72rem' }}>JPG, PNG, WebP — máx. 15MB</span>
                            </div>
                          )}
                          <input
                            id="map-image-upload-input"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => handleImageFileChange(e, 'tripMap')}
                          />
                        </label>
                        {(mapImageUploadPreview || (tripForm.mapImage && tripForm.mapImage.startsWith('data:'))) && (
                          <button
                            type="button"
                            style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => { setMapImageUploadPreview(null); setTripForm(prev => ({...prev, mapImage: ''})); }}
                          >
                            ✕ Remover imagem do mapa
                          </button>
                        )}
                      </div>
                    )}

                    {/* Preview quando URL digitada */}
                    {mapImageInputMode === 'url' && tripForm.mapImage && !tripForm.mapImage.startsWith('data:') && (
                      <img
                        src={tripForm.mapImage}
                        alt="preview do mapa"
                        style={{ marginTop: '8px', width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>

                  <div className="form-group-custom">
                    <label>Distâncias do Roteiro (uma por linha)</label>
                    <textarea 
                      value={tripForm.mapDistances} 
                      onChange={e => setTripForm({...tripForm, mapDistances: e.target.value})} 
                      rows="3" 
                      placeholder="Ex: Roma ➔ Sorrento: ~260 km&#10;Sorrento ➔ Palermo: ~270 km (via marítima)&#10;Roma ➔ Palermo: ~430 km"
                    ></textarea>
                  </div>
                </div>

                <div className="form-group-custom">
                  <label>Breve Descrição Editorial</label>
                  <textarea 
                    value={tripForm.description} 
                    onChange={e => setTripForm({...tripForm, description: e.target.value})} 
                    rows="4" 
                    placeholder="Texto curto e atrativo sobre a viagem..."
                    required 
                  ></textarea>
                </div>

                <div className="form-group-custom">
                  <label>O que está incluso no pacote (um item por linha)</label>
                  <textarea 
                    value={tripForm.included} 
                    onChange={e => setTripForm({...tripForm, included: e.target.value})} 
                    rows="4" 
                    placeholder="Ex: Hospedagem com café da manhã&#10;Traslados privativos&#10;Passeios guiados com ingressos..."
                  ></textarea>
                </div>

                <div className="form-row-two-col">
                  <div className="form-group-custom">
                    <label>URL do Vídeo (YouTube Shorts/Embed)</label>
                    <input 
                      type="url" 
                      value={tripForm.videoUrl || ''} 
                      onChange={e => setTripForm({...tripForm, videoUrl: e.target.value})} 
                      placeholder="Ex: https://youtube.com/shorts/..." 
                    />
                  </div>
                  <div className="form-group-custom">
                    <label>Título do Vídeo (Opcional)</label>
                    <input 
                      type="text" 
                      value={tripForm.videoTitle || ''} 
                      onChange={e => setTripForm({...tripForm, videoTitle: e.target.value})} 
                      placeholder="Ex: Grotta Palazzese, Puglia" 
                    />
                  </div>
                </div>

                <div className="form-group-custom" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                  <input 
                    type="checkbox" 
                    id="send-push-notification" 
                    checked={sendPush} 
                    onChange={e => setSendPush(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer', margin: 0 }}
                  />
                  <label htmlFor="send-push-notification" style={{ marginBottom: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-dark-green)' }}>
                    Enviar notificação no celular dos clientes sobre esta viagem
                  </label>
                </div>
              </div>

              <div className="modal-actions-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Viagem</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL DE ADICIONAR / EDITAR DEPOIMENTO */}
      {isTestimonialModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card glass-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{testimonialModalMode === 'add' ? 'Adicionar Depoimento' : 'Editar Depoimento'}</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsTestimonialModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleTestimonialFormSubmit} className="modal-form-single-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group-custom">
                <label>Nome do Viajante</label>
                <input 
                  type="text" 
                  value={testimonialForm.name} 
                  onChange={e => setTestimonialForm({...testimonialForm, name: e.target.value})} 
                  placeholder="Ex: Mariana L." 
                  required 
                />
              </div>

              <div className="form-group-custom">
                <label>Cidade / Estado</label>
                <input 
                  type="text" 
                  value={testimonialForm.location} 
                  onChange={e => setTestimonialForm({...testimonialForm, location: e.target.value})} 
                  placeholder="Ex: São Paulo, SP" 
                  required 
                />
              </div>

              <div className="form-group-custom">
                <label>Viagem / Destino Realizado</label>
                <input 
                  type="text" 
                  value={testimonialForm.trip} 
                  onChange={e => setTestimonialForm({...testimonialForm, trip: e.target.value})} 
                  placeholder="Ex: Toscana & Vinhos" 
                  required 
                />
              </div>

              <div className="form-group-custom">
                <label>Estrelas (Avaliação)</label>
                <select 
                  value={testimonialForm.stars} 
                  onChange={e => setTestimonialForm({...testimonialForm, stars: Number(e.target.value)})}
                >
                  <option value={5}>5 Estrelas</option>
                  <option value={4}>4 Estrelas</option>
                  <option value={3}>3 Estrelas</option>
                  <option value={2}>2 Estrelas</option>
                  <option value={1}>1 Estrela</option>
                </select>
              </div>

              <div className="form-group-custom">
                <label>Mensagem do Depoimento</label>
                <textarea 
                  value={testimonialForm.text} 
                  onChange={e => setTestimonialForm({...testimonialForm, text: e.target.value})} 
                  rows="4" 
                  placeholder="Escreva o depoimento do cliente..."
                  required 
                ></textarea>
              </div>

              <div className="modal-actions-footer" style={{ gridColumn: 'span 1' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsTestimonialModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Depoimento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL DE ADICIONAR / EDITAR DESTINO */}
      {isDestinationModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card glass-card">
            <div className="modal-header">
              <h3>{destinationModalMode === 'add' ? 'Adicionar Novo Destino' : 'Editar Destino'}</h3>
              <button className="close-modal-btn" onClick={() => setIsDestinationModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleDestinationFormSubmit} className="modal-form-grid">
              {/* Coluna da Esquerda */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label>Título do Destino</label>
                  <input 
                    type="text" 
                    value={destinationForm.title} 
                    onChange={e => setDestinationForm({...destinationForm, title: e.target.value})} 
                    placeholder="Ex: Toscana" 
                    required 
                  />
                </div>

                <div className="form-group-custom">
                  <label>País</label>
                  <input 
                    type="text" 
                    value={destinationForm.country} 
                    onChange={e => setDestinationForm({...destinationForm, country: e.target.value})} 
                    placeholder="Ex: Itália, Norte da Europa..." 
                    required 
                  />
                </div>

                <div className="form-group-custom">
                  <label>Tags (separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={destinationForm.tagsString} 
                    onChange={e => setDestinationForm({...destinationForm, tagsString: e.target.value})} 
                    placeholder="Ex: Vinhos, Cultura, Exclusivo" 
                  />
                </div>

                <div className="form-group-custom">
                  <label>Destaques / Experiências (separadas por vírgula)</label>
                  <input 
                    type="text" 
                    value={destinationForm.highlightsString} 
                    onChange={e => setDestinationForm({...destinationForm, highlightsString: e.target.value})} 
                    placeholder="Ex: Degustações, Vilarejos, Passeio de Barco" 
                  />
                </div>
              </div>

              {/* Coluna da Direita */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span>Imagem de Capa</span>
                    {/* Toggle URL / Upload */}
                    <div style={{ display: 'flex', background: 'var(--color-bg-cream)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => { setImageInputMode('url'); setImageUploadPreview(null); }}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'url' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'url' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        🔗 URL
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImageInputMode('upload'); setImageUploadPreview(null); }}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'upload' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'upload' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        📁 Upload
                      </button>
                    </div>
                  </label>

                  {imageInputMode === 'url' ? (
                    <input
                      type="url"
                      value={destinationForm.image && !destinationForm.image.startsWith('data:') ? destinationForm.image : ''}
                      onChange={e => setDestinationForm({...destinationForm, image: e.target.value})}
                      placeholder="https://images.unsplash.com/..."
                    />
                  ) : (
                    <div>
                      <label
                        htmlFor="dest-image-upload-input"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '2px dashed var(--glass-border)', borderRadius: '8px', padding: '20px',
                          cursor: 'pointer', background: 'var(--color-bg-cream)', transition: 'border-color 0.2s',
                          gap: '8px'
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const file = e.dataTransfer.files[0];
                          if (file) handleImageFileChange({ target: { files: [file] } }, 'destination');
                        }}
                      >
                        {imageUploadPreview || (destinationForm.image && destinationForm.image.startsWith('data:')) ? (
                          <img
                            src={imageUploadPreview || destinationForm.image}
                            alt="preview"
                            style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📷</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-dark-green)' }}>Clique para escolher ou arraste aqui</span>
                            <br/>
                            <span style={{ fontSize: '0.72rem' }}>JPG, PNG, WebP — máx. 15MB (otimizada automaticamente)</span>
                          </div>
                        )}
                        <input
                          id="dest-image-upload-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handleImageFileChange(e, 'destination')}
                        />
                      </label>
                      {(imageUploadPreview || (destinationForm.image && destinationForm.image.startsWith('data:'))) && (
                        <button
                          type="button"
                          style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setImageUploadPreview(null); setDestinationForm(prev => ({...prev, image: ''})); }}
                        >
                          ✕ Remover imagem
                        </button>
                      )}
                    </div>
                  )}

                  {/* Preview quando URL digitada */}
                  {imageInputMode === 'url' && destinationForm.image && !destinationForm.image.startsWith('data:') && (
                    <img
                      src={destinationForm.image}
                      alt="preview"
                      style={{ marginTop: '8px', width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="form-group-custom">
                  <label>Breve Descrição Editorial</label>
                  <textarea 
                    value={destinationForm.description} 
                    onChange={e => setDestinationForm({...destinationForm, description: e.target.value})} 
                    rows="4" 
                    placeholder="Texto editorial atrativo sobre o destino..."
                    required 
                  ></textarea>
                </div>
              </div>

              <div className="modal-actions-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsDestinationModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Destino</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL DE ADICIONAR / EDITAR MOMENTO */}
      {isMomentModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card glass-card">
            <div className="modal-header">
              <h3>{momentModalMode === 'add' ? 'Adicionar Registro em Momentos' : 'Editar Registro em Momentos'}</h3>
              <button className="close-modal-btn" onClick={() => setIsMomentModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleMomentFormSubmit} className="modal-form-grid">
              {/* Coluna da Esquerda */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label>Título do Momento</label>
                  <input 
                    type="text" 
                    value={momentForm.title} 
                    onChange={e => setMomentForm({...momentForm, title: e.target.value})} 
                    placeholder="Ex: Brinde ao pôr do sol na Toscana" 
                  />
                </div>

                <div className="form-row-two-col">
                  <div className="form-group-custom">
                    <label>Tipo de Mídia</label>
                    <select 
                      value={momentForm.type} 
                      onChange={e => setMomentForm({...momentForm, type: e.target.value})}
                    >
                      <option value="photo">Foto</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </div>

                  <div className="form-group-custom">
                    <label>Categoria</label>
                    <select 
                      value={momentForm.category} 
                      onChange={e => setMomentForm({...momentForm, category: e.target.value})}
                    >
                      <option value="Itália">Itália</option>
                      <option value="Portugal">Portugal</option>
                      <option value="Experiências">Experiências</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-two-col">
                  <div className="form-group-custom">
                    <label>Localização (Cidade, País)</label>
                    <input 
                      type="text" 
                      value={momentForm.location} 
                      onChange={e => setMomentForm({...momentForm, location: e.target.value})} 
                      placeholder="Ex: Val d'Orcia, Itália" 
                    />
                  </div>

                  <div className="form-group-custom">
                    <label>Data / Época</label>
                    <input 
                      type="text" 
                      value={momentForm.date} 
                      onChange={e => setMomentForm({...momentForm, date: e.target.value})} 
                      placeholder="Ex: Setembro de 2024" 
                    />
                  </div>
                </div>

                {momentForm.type === 'video' && (
                  <div className="form-group-custom">
                    <label>URL do Vídeo (.mp4 ou streaming)</label>
                    <input 
                      type="url" 
                      value={momentForm.videoUrl} 
                      onChange={e => setMomentForm({...momentForm, videoUrl: e.target.value})} 
                      placeholder="Ex: https://www.w3schools.com/html/mov_bbb.mp4" 
                      required={momentForm.type === 'video'}
                    />
                  </div>
                )}
              </div>

              {/* Coluna da Direita */}
              <div className="form-col">
                <div className="form-group-custom">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span>Imagem ou Thumb do Vídeo</span>
                    {/* Toggle URL / Upload */}
                    <div style={{ display: 'flex', background: 'var(--color-bg-cream)', borderRadius: '20px', padding: '3px', border: '1px solid var(--glass-border)', gap: '2px' }}>
                      <button
                        type="button"
                        onClick={() => { setImageInputMode('url'); setImageUploadPreview(null); }}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'url' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'url' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        🔗 URL
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImageInputMode('upload'); setImageUploadPreview(null); }}
                        style={{
                          padding: '3px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600',
                          background: imageInputMode === 'upload' ? 'var(--color-dark-green)' : 'transparent',
                          color: imageInputMode === 'upload' ? '#fff' : 'var(--color-text-muted)',
                          transition: 'all 0.2s'
                        }}
                      >
                        📁 Upload
                      </button>
                    </div>
                  </label>

                  {imageInputMode === 'url' ? (
                    <input
                      type="url"
                      value={momentForm.image && !momentForm.image.startsWith('data:') ? momentForm.image : ''}
                      onChange={e => setMomentForm({...momentForm, image: e.target.value})}
                      placeholder="https://images.unsplash.com/..."
                      required={imageInputMode === 'url'}
                    />
                  ) : (
                    <div>
                      <label
                        htmlFor="moment-image-upload-input"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          border: '2px dashed var(--glass-border)', borderRadius: '8px', padding: '20px',
                          cursor: 'pointer', background: 'var(--color-bg-cream)', transition: 'border-color 0.2s',
                          gap: '8px'
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault();
                          const file = e.dataTransfer.files[0];
                          if (file) handleImageFileChange({ target: { files: [file] } }, 'moment');
                        }}
                      >
                        {imageUploadPreview || (momentForm.image && momentForm.image.startsWith('data:')) ? (
                          <img
                            src={imageUploadPreview || momentForm.image}
                            alt="preview"
                            style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📷</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-dark-green)' }}>Clique para escolher ou arraste aqui</span>
                            <br/>
                            <span style={{ fontSize: '0.72rem' }}>JPG, PNG, WebP — máx. 15MB (otimizada automaticamente)</span>
                          </div>
                        )}
                        <input
                          id="moment-image-upload-input"
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={e => handleImageFileChange(e, 'moment')}
                        />
                      </label>
                      {(imageUploadPreview || (momentForm.image && momentForm.image.startsWith('data:'))) && (
                        <button
                          type="button"
                          style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-accent-red)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setImageUploadPreview(null); setMomentForm(prev => ({...prev, image: ''})); }}
                        >
                          ✕ Remover imagem
                        </button>
                      )}
                    </div>
                  )}

                  {/* Preview quando URL digitada */}
                  {imageInputMode === 'url' && momentForm.image && !momentForm.image.startsWith('data:') && (
                    <img
                      src={momentForm.image}
                      alt="preview"
                      style={{ marginTop: '8px', width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                </div>

                <div className="form-group-custom">
                  <label>Breve Descrição do Registro</label>
                  <textarea 
                    value={momentForm.description} 
                    onChange={e => setMomentForm({...momentForm, description: e.target.value})} 
                    rows="4" 
                    placeholder="Conte a história por trás desse momento..."
                  ></textarea>
                </div>
              </div>

              <div className="modal-actions-footer">
                <button type="button" className="btn btn-outline" onClick={() => setIsMomentModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Premium */}
      {feedback.message && (
        <div className={`toast-notification glass-card toast-${feedback.type} animate-fade-in`}>
          {feedback.type === 'success' ? (
            <CheckCircle className="toast-icon success" size={20} />
          ) : (
            <AlertCircle className="toast-icon error" size={20} />
          )}
          <div className="toast-content">
            <p>{feedback.message}</p>
          </div>
          <button type="button" className="toast-close-btn" onClick={() => setFeedback({ type: '', message: '' })}>&times;</button>
        </div>
      )}

      <style>{`
        .admin-page-container {
          padding-top: 50px;
          padding-bottom: 100px;
          min-height: 70vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .admin-loading-screen {
          min-height: 80vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-dark-green);
        }

        .admin-loading-screen p {
          margin-top: 16px;
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-text-muted);
        }

        /* LOGIN CARD */
        .login-card-container {
          max-width: 480px;
          width: 100%;
          margin: 0 auto;
        }

        .login-card {
          padding: 40px;
          border-radius: var(--border-radius-md);
        }

        .admin-shield-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: var(--color-bg-cream);
          color: var(--color-dark-green);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px auto;
        }

        .login-header h2 {
          font-family: var(--font-title);
          font-size: 2.2rem;
          color: var(--color-dark-green);
          margin-bottom: 8px;
        }

        .login-header p {
          font-size: 0.85rem;
          color: var(--color-text-muted);
          margin-bottom: 15px;
        }

        .connection-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 30px;
          background-color: var(--color-bg-cream);
          margin-bottom: 25px;
        }
        
        .connection-indicator.online { color: #128C7E; }
        .connection-indicator.offline { color: var(--color-primary-gold-dark); }

        .connection-indicator .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
          display: inline-block;
        }

        .login-error-msg {
          background-color: rgba(139, 74, 62, 0.1);
          border: 1px solid var(--color-accent-red);
          color: var(--color-accent-red);
          padding: 12px;
          border-radius: var(--border-radius-sm);
          font-size: 0.85rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          background-color: var(--color-bg-white);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
          padding: 12px 16px;
        }

        .input-icon {
          color: var(--color-text-muted);
          margin-right: 12px;
          flex-shrink: 0;
        }

        .input-wrapper input {
          border: none;
          background: none;
          outline: none;
          width: 100%;
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-text-dark);
        }

        .toggle-pass-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          margin-left: 8px;
        }

        /* DASHBOARD LAYOUT */
        .dashboard-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: 40px;
          align-items: start;
          width: 100%;
        }

        .dashboard-sidebar {
          padding: 30px;
          border-radius: var(--border-radius-md);
          display: flex;
          flex-direction: column;
          min-height: 480px;
        }

        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 20px;
          margin-bottom: 30px;
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: var(--color-primary-gold);
          color: var(--color-dark-green-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .sidebar-profile h4 {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-dark-green);
        }

        .sidebar-profile span {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
        }

        .sidebar-nav-btn {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--border-radius-sm);
          color: var(--color-text-dark);
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-fast);
          width: 100%;
          text-align: left;
        }

        .sidebar-nav-btn:hover, .sidebar-nav-btn.active {
          background-color: var(--color-bg-cream);
          color: var(--color-dark-green-dark);
        }

        .btn-logout-sidebar {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          color: var(--color-accent-red);
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          padding: 12px 16px;
          width: 100%;
          transition: var(--transition-fast);
        }

        .btn-logout-sidebar:hover {
          background-color: rgba(139, 74, 62, 0.05);
          border-radius: var(--border-radius-sm);
        }

        /* MAIN PANEL */
        .dashboard-panel {
          padding: 40px;
          border-radius: var(--border-radius-md);
          min-height: 480px;
        }

        .panel-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 24px;
          margin-bottom: 30px;
        }

        .panel-header-row h2 {
          font-family: var(--font-title);
          font-size: 2.2rem;
          color: var(--color-dark-green);
        }

        .panel-header-row p {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        .panel-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
          color: var(--color-primary-gold-dark);
        }
        
        .panel-loading p {
          margin-top: 12px;
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }

        .spinner-icon {
          animation: spin 1.5s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* TRIPS LIST */
        .admin-trips-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .admin-trip-row {
          display: grid;
          grid-template-columns: 70px 1.8fr 1fr 1.5fr;
          gap: 20px;
          align-items: center;
          padding: 16px;
          background-color: var(--color-bg-white);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-sm);
          transition: var(--transition-fast);
        }

        .admin-trip-row:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          border-color: var(--color-primary-gold-light);
        }

        .trip-row-thumb {
          width: 70px;
          height: 52px;
          object-fit: cover;
          border-radius: 3px;
        }

        .trip-row-details h4 {
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--color-dark-green);
        }

        .trip-row-details span {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .status-badge-admin {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 30px;
          color: #FFFFFF;
          display: inline-block;
          text-align: center;
        }

        .status-badge-admin.status-ativo { background-color: var(--color-dark-green); }
        .status-badge-admin.status-vagas-limitadas { background-color: var(--color-accent-red); }
        .status-badge-admin.status-esgotado { background-color: var(--color-text-muted); }

        .trip-row-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .row-action-btn {
          background: none;
          border: 1px solid transparent;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          padding: 8px 14px;
          border-radius: var(--border-radius-sm);
          transition: var(--transition-fast);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .row-action-btn.edit {
          border-color: var(--color-primary-gold);
          color: var(--color-primary-gold-dark);
        }

        .row-action-btn.edit:hover {
          background-color: var(--color-primary-gold);
          color: var(--color-dark-green-dark);
        }

        .row-action-btn.delete {
          border-color: var(--color-accent-red);
          color: var(--color-accent-red);
        }

        .row-action-btn.delete:hover {
          background-color: var(--color-accent-red);
          color: #FFFFFF;
        }

        .no-trips-card {
          padding: 60px 40px;
          background-color: rgba(255,255,255,0.4);
          border: 1px dashed var(--color-primary-gold-light);
          border-radius: var(--border-radius-md);
        }

        .no-trips-card h3 {
          font-family: var(--font-title);
          font-size: 1.6rem;
          color: var(--color-dark-green);
          margin-bottom: 6px;
        }

        .no-trips-card p {
          font-size: 0.85rem;
          color: var(--color-text-muted);
        }

        /* CONFIG TAB CARD */
        .config-box-card {
          max-width: 600px;
        }

        .config-status-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          background-color: var(--color-bg-cream);
          border: 1px solid var(--color-primary-gold-light);
          padding: 20px;
          border-radius: var(--border-radius-sm);
          margin-bottom: 30px;
        }

        .status-db-icon {
          color: var(--color-primary-gold-dark);
        }

        .connection-status {
          display: inline-flex;
          align-items: center;
          font-size: 0.8rem;
          font-weight: 700;
          margin-top: 4px;
        }

        .connection-status.connected { color: #128C7E; }
        .connection-status.disconnected { color: var(--color-accent-red); }

        .config-info-form input {
          background-color: rgba(255,255,255,0.4);
          cursor: not-allowed;
        }

        .db-actions-row {
          margin-top: 24px;
          border-top: 1px solid var(--glass-border);
          padding-top: 24px;
        }

        /* MODAL OVERLAY */
        .admin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(26, 38, 29, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .admin-modal-card {
          max-width: 900px;
          width: 100%;
          background-color: rgba(250, 248, 245, 0.95);
          border-radius: var(--border-radius-md);
          padding: 36px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 16px;
          margin-bottom: 24px;
        }

        .modal-header h3 {
          font-family: var(--font-title);
          font-size: 1.8rem;
          color: var(--color-dark-green);
        }

        .close-modal-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          padding: 6px;
          border-radius: 50%;
        }

        .close-modal-btn:hover {
          background-color: rgba(0,0,0,0.05);
          color: var(--color-text-dark);
        }

        .modal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        .form-col {
          display: flex;
          flex-direction: column;
        }

        .form-row-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-row-three-col {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
        }

        .form-group-custom textarea {
          resize: vertical;
        }

        .modal-actions-footer {
          grid-column: span 2;
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          border-top: 1px solid var(--glass-border);
          padding-top: 24px;
          margin-top: 12px;
        }

        .admin-testimonial-row {
          grid-template-columns: 50px 2fr 1fr 1.5fr;
        }

        @media (max-width: 992px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .dashboard-sidebar {
            min-height: auto;
          }

          .modal-form-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .modal-actions-footer {
            grid-column: span 1;
          }
        }

        @media (max-width: 768px) {
          .dashboard-panel {
            padding: 20px 16px;
          }

          .panel-header-row {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            text-align: center;
          }

          .panel-header-row button {
            width: 100%;
            justify-content: center;
          }

          .admin-trip-row {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 12px;
          }

          .admin-testimonial-row {
            grid-template-columns: 1fr !important;
            text-align: center;
            gap: 12px;
          }

          .trip-row-thumb {
            margin: 0 auto;
          }

          .trip-row-actions {
            justify-content: center;
          }
        }

        /* CONFIG CARD SETUP & LAYOUT */
        .config-form-setup-container {
          width: 100%;
        }

        .config-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }

        .config-card-section {
          padding: 30px;
          border-radius: var(--border-radius-md);
          background-color: rgba(255, 255, 255, 0.4);
          border: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-title-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 14px;
        }

        .section-title-wrapper h3 {
          font-family: var(--font-body);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-dark-green);
          margin: 0;
        }

        .section-icon {
          color: var(--color-primary-gold-dark);
          flex-shrink: 0;
        }

        .section-fields {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field-tip {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          margin-top: 4px;
          display: block;
        }

        .config-help-notice {
          display: flex;
          gap: 12px;
          background-color: var(--color-bg-cream);
          border: 1px solid var(--color-primary-gold-light);
          padding: 16px;
          border-radius: var(--border-radius-sm);
          margin-top: 10px;
          align-items: flex-start;
          text-align: left;
        }

        .config-help-notice p {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin: 0;
        }

        .notice-icon {
          color: var(--color-primary-gold-dark);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .form-submit-row {
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid var(--glass-border);
          padding-top: 20px;
        }

        .btn-with-icon {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        /* TOAST NOTIFICATION PREMIUM */
        .toast-notification {
          position: fixed;
          bottom: 30px;
          right: 30px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          border-radius: var(--border-radius-sm);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          z-index: 999999;
          max-width: 420px;
          background: rgba(250, 248, 245, 0.95);
          animation: slideIn 0.3s ease-out forwards;
        }

        @keyframes slideIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .toast-icon {
          flex-shrink: 0;
        }

        .toast-icon.success {
          color: #128C7E;
        }

        .toast-icon.error {
          color: var(--color-accent-red);
        }

        .toast-content p {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-text-dark);
          margin: 0;
          text-align: left;
        }

        .toast-close-btn {
          background: none;
          border: none;
          color: var(--color-text-muted);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          margin-left: 10px;
        }

        .toast-close-btn:hover {
          color: var(--color-text-dark);
        }

        /* Cores de borda para diferenciação sutil */
        .toast-success {
          border-left: 4px solid #128C7E;
        }

        .toast-error {
          border-left: 4px solid var(--color-accent-red);
        }

        @media (max-width: 992px) {
          .config-cards-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        /* =============================================
           ESTILOS DA ABA: GERENCIAR DESTINOS
        ============================================= */
        .destinations-admin-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .destination-admin-card {
          border-radius: var(--border-radius-sm);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: var(--transition-smooth);
          border: 1px solid var(--glass-border);
        }

        .destination-admin-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-medium);
          border-color: rgba(197, 168, 128, 0.3);
        }

        .dest-card-image-wrapper {
          position: relative;
          height: 140px;
          overflow: hidden;
          background-color: var(--color-bg-cream);
        }

        .dest-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s ease;
        }

        .destination-admin-card:hover .dest-card-image {
          transform: scale(1.05);
        }

        .dest-card-image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          background: linear-gradient(135deg, var(--color-bg-cream) 0%, var(--color-bg-light) 100%);
        }

        .dest-status-badge {
          position: absolute;
          top: 10px;
          right: 10px;
        }

        .dest-card-body {
          padding: 14px 16px;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .dest-card-country {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-primary-gold-dark);
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .dest-card-title {
          font-family: var(--font-title);
          font-size: 1.2rem;
          color: var(--color-dark-green);
          font-weight: 400;
          margin: 0;
        }

        .dest-card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }

        .dest-price {
          font-weight: 700;
          color: var(--color-primary-gold-dark);
          font-size: 0.82rem;
        }

        .dest-card-desc {
          font-size: 0.78rem;
          line-height: 1.5;
          color: var(--color-text-muted);
          margin-top: 4px;
        }

        .dest-card-actions {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid var(--glass-border);
          background-color: rgba(250, 248, 245, 0.5);
        }

        @media (max-width: 1100px) {
          .destinations-admin-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .destinations-admin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
