
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User } from "firebase/auth";
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AIChat from './pages/AIChat';
import CustomersPage from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import ContractsPage from './pages/Contracts';
import ProductsPage from './pages/Products';
import AppointmentsPage from './pages/Appointments';
import MessageTemplatesPage from './pages/MessageTemplates';
import SettingsPage from './pages/Settings';
import AdvisoryPage from './pages/Advisory';
import ProductAdvisoryPage from './pages/ProductAdvisory';
import LoginPage from './pages/Login';

import { AppState, Customer, Contract, Product, Appointment, AgentProfile, Illustration } from './types';
import { subscribeToCollection, addData, updateData, deleteData, COLLECTIONS } from './services/db';
import { subscribeToAuth } from './services/auth';
import { isFirebaseReady } from './services/firebaseConfig';
import { INITIAL_CUSTOMERS, INITIAL_CONTRACTS, INITIAL_PRODUCTS, INITIAL_APPOINTMENTS } from './constants';
import { runCustomerAutomations } from './services/automationService';

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [state, setState] = useState<AppState>({
        customers: [], contracts: [], products: [], appointments: [], agentProfile: null, messageTemplates: [], illustrations: []
    });

    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        return localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        if (!isFirebaseReady) {
            setUser({ uid: 'demo-user-123', displayName: 'Demo Agent' } as User);
            setState({
                customers: INITIAL_CUSTOMERS,
                contracts: INITIAL_CONTRACTS,
                products: INITIAL_PRODUCTS,
                appointments: INITIAL_APPOINTMENTS,
                agentProfile: { id: 'demo-profile', fullName: 'Demo Agent', age: 28, address: 'Hà Nội', phone: '0987654321', email: 'demo@tuanchom.com', office: 'Prudential Demo Office', agentCode: '60012345', title: 'MDRT 2024', bio: 'Chuyên gia tư vấn tài chính.', targets: { weekly: 0, monthly: 0, quarterly: 0, yearly: 0 } },
                messageTemplates: [],
                illustrations: []
            });
            setAuthLoading(false);
            return;
        }

        const unsubscribeAuth = subscribeToAuth((currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user || !isFirebaseReady) return;
        const unsubs = [
            subscribeToCollection(COLLECTIONS.CUSTOMERS, (data) => setState(prev => ({ ...prev, customers: data }))),
            subscribeToCollection(COLLECTIONS.PRODUCTS, (data) => setState(prev => ({ ...prev, products: data }))),
            subscribeToCollection(COLLECTIONS.CONTRACTS, (data) => setState(prev => ({ ...prev, contracts: data }))),
            subscribeToCollection(COLLECTIONS.APPOINTMENTS, (data) => setState(prev => ({ ...prev, appointments: data }))),
            subscribeToCollection(COLLECTIONS.MESSAGE_TEMPLATES, (data) => setState(prev => ({ ...prev, messageTemplates: data }))),
            subscribeToCollection(COLLECTIONS.ILLUSTRATIONS, (data) => setState(prev => ({ ...prev, illustrations: data }))),
            subscribeToCollection(COLLECTIONS.SETTINGS, (data) => { if (data && data.length > 0) setState(prev => ({ ...prev, agentProfile: data[0] as AgentProfile })); })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, [user]);

    useEffect(() => {
        if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; }
        else { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; }
    }, [isDarkMode]);

    const isDemo = !isFirebaseReady;

    const addAppointment = async (a: Appointment) => { 
        if(isDemo) { setState(prev => ({...prev, appointments: [...prev.appointments, a]})); return; } 
        await addData(COLLECTIONS.APPOINTMENTS, a); 
    };

    const updateAppointment = async (a: Appointment) => { 
        if(isDemo) { setState(prev => ({...prev, appointments: prev.appointments.map(x => x.id === a.id ? a : x)})); return; } 
        await updateData(COLLECTIONS.APPOINTMENTS, a.id, a); 
    };

    const addCustomer = async (c: Customer) => { 
        if(isDemo) { setState(prev => ({...prev, customers: [c, ...prev.customers]})); return; } 
        await addData(COLLECTIONS.CUSTOMERS, c); 
    };

    // --- ENHANCED UPDATE CUSTOMER WITH AUTOMATION ---
    const updateCustomer = async (newCustomer: Customer) => {
        const oldCustomer = state.customers.find(c => c.id === newCustomer.id);
        
        // 1. Chạy bộ máy tự động hóa để tìm các thay đổi cần xử lý
        const { appointmentsToUpdate, appointmentsToAdd, newTimelineItems } = runCustomerAutomations(
            oldCustomer, 
            newCustomer, 
            state.appointments
        );

        // 2. Cập nhật Customer (bao gồm cả timeline mới nếu có)
        const customerToSave = {
            ...newCustomer,
            timeline: [...newTimelineItems, ...(newCustomer.timeline || [])]
        };

        if (isDemo) {
            setState(prev => ({
                ...prev,
                customers: prev.customers.map(item => item.id === newCustomer.id ? customerToSave : item)
            }));
        } else {
            await updateData(COLLECTIONS.CUSTOMERS, newCustomer.id, customerToSave);
        }

        // 3. Thực thi các thay đổi lịch hẹn tự động
        for (const app of appointmentsToAdd) await addAppointment(app);
        for (const app of appointmentsToUpdate) await updateAppointment(app);
    };

    const deleteCustomer = async (id: string) => { if(isDemo) { setState(prev => ({...prev, customers: prev.customers.filter(item => item.id !== id)})); return; } await deleteData(COLLECTIONS.CUSTOMERS, id); };

    const updateContract = async (c: Contract) => { if(isDemo) { setState(prev => ({...prev, contracts: prev.contracts.map(item => item.id === c.id ? c : item)})); return; } await updateData(COLLECTIONS.CONTRACTS, c.id, c); };
    const deleteAppointment = async (id: string) => { if(isDemo) { setState(prev => ({...prev, appointments: prev.appointments.filter(item => item.id !== id)})); return; } await deleteData(COLLECTIONS.APPOINTMENTS, id); };
    const saveIllustration = async (ill: Illustration) => { if(isDemo) { setState(prev => ({...prev, illustrations: [ill, ...prev.illustrations]})); return; } await addData(COLLECTIONS.ILLUSTRATIONS, ill); };

    if (authLoading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-50"><div className="w-12 h-12 border-4 border-pru-red border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <Router>
            <Routes>
                {!user ? (
                    <Route path="*" element={<LoginPage />} />
                ) : (
                    <>
                        <Route path="/" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <Dashboard state={state} onUpdateContract={updateContract} onAddAppointment={addAppointment} onUpdateCustomer={updateCustomer} onUpdateAppointment={updateAppointment} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/customers" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <CustomersPage customers={state.customers} contracts={state.contracts} appointments={state.appointments} onAdd={addCustomer} onUpdate={updateCustomer} onDelete={deleteCustomer} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/customers/:id" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <CustomerDetail customers={state.customers} contracts={state.contracts} onUpdateCustomer={updateCustomer} onAddCustomer={addCustomer} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/appointments" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <AppointmentsPage appointments={state.appointments} customers={state.customers} contracts={state.contracts} onAdd={addAppointment} onUpdate={updateAppointment} onDelete={deleteAppointment} onUpdateCustomer={updateCustomer} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/contracts" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <ContractsPage contracts={state.contracts} customers={state.customers} products={state.products} onAdd={async (c) => { if(isDemo) setState(prev => ({...prev, contracts: [c, ...prev.contracts]})); else await addData(COLLECTIONS.CONTRACTS, c); }} onUpdate={updateContract} onDelete={async (id) => {}} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/advisory/:id" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <AdvisoryPage customers={state.customers} contracts={state.contracts} agentProfile={state.agentProfile} onUpdateCustomer={updateCustomer} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/product-advisory" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <ProductAdvisoryPage customers={state.customers} products={state.products} onSaveIllustration={saveIllustration} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="/settings" element={
                            <Layout onToggleChat={() => setIsChatOpen(!isChatOpen)} user={user}>
                                <SettingsPage profile={state.agentProfile} onSave={(p) => isDemo ? setState(prev => ({...prev, agentProfile: p})) : updateData(COLLECTIONS.SETTINGS, state.agentProfile?.id || '', p)} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
                                <AIChat state={state} isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
                            </Layout>
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                )}
            </Routes>
        </Router>
    );
};

export default App;
