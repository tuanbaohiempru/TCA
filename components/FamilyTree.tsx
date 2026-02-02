
import React, { useMemo, useCallback, useState } from 'react';
// 1. Sử dụng Named Export cho ReactFlow để tương thích tốt hơn
// 2. Tách biệt hoàn toàn import type
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle
} from 'reactflow';
import type { Edge, Node } from 'reactflow';

import 'reactflow/dist/style.css';
// 3. Fix import dagre: Dagre là thư viện cũ (CommonJS), cần import * as
import * as dagre from 'dagre';

import { Customer, RelationshipType, CustomerStatus, Contract, ContractStatus } from '../types';
import { useNavigate } from 'react-router-dom';

interface FamilyTreeProps {
  centerCustomer: Customer;
  allCustomers: Customer[];
  contracts: Contract[];
}

type ViewMode = 'family' | 'referral';

// --- CUSTOM NODE COMPONENT ---
const FamilyNode = ({ data }: { data: any }) => {
  const isCenter = data.isCenter;
  const hasActiveContract = data.hasActiveContract;
  const isVipReferrer = data.isVipReferrer;

  return (
    <div 
      className={`relative w-48 rounded-xl border-2 shadow-lg transition-all hover:scale-105 bg-white dark:bg-gray-800 ${
        isCenter 
          ? 'border-pru-red ring-4 ring-red-100 dark:ring-red-900/30' 
          : isVipReferrer 
            ? 'border-yellow-400 ring-2 ring-yellow-100 dark:ring-yellow-900/20'
            : hasActiveContract 
              ? 'border-green-500' 
              : 'border-gray-300 dark:border-gray-600 border-dashed'
      }`}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-1 !rounded-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-1 !rounded-none" />

      {/* Header Color Bar */}
      <div className={`h-2 w-full rounded-t-lg ${isVipReferrer ? 'bg-yellow-400' : hasActiveContract ? 'bg-green-500' : 'bg-gray-300'}`}></div>

      {isVipReferrer && (
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white dark:border-gray-800 z-10" title="VIP: Đã giới thiệu nhiều khách">
              <i className="fas fa-gem text-xs"></i>
          </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
             data.gender === 'Nữ' ? 'bg-pink-500' : 'bg-blue-600'
          }`}>
            {data.label.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate">{data.label}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold truncate">{data.role}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="mt-3 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">{data.age ? `${data.age} tuổi` : '?? tuổi'}</span>
            {hasActiveContract ? (
                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold border border-green-200">
                    <i className="fas fa-shield-alt mr-1"></i> Đã bảo vệ
                </span>
            ) : (
                <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold border border-yellow-200">
                    <i className="fas fa-exclamation-circle mr-1"></i> Tiềm năng
                </span>
            )}
        </div>
        
        {/* Referral Stats (Only in Referral Mode) */}
        {data.referralCount !== undefined && data.referralCount > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                    <i className="fas fa-users mr-1"></i> Giới thiệu: {data.referralCount} người
                </span>
            </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = {
  familyNode: FamilyNode,
};

// --- DAGRE LAYOUT ALGORITHM ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 200;
  const nodeHeight = 120; // Increased slightly for stats

  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Add small randomization to avoid perfect overlap if dagre fails
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes: layoutedNodes, edges };
};

const FamilyTree: React.FC<FamilyTreeProps> = ({ centerCustomer, allCustomers, contracts }) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('family');

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const processedIds = new Set<string>();

    // Helper to get age
    const getAge = (dob: string) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
    
    // Helper to check active contract
    const checkActive = (cusId: string) => contracts.some(c => c.customerId === cusId && c.status === ContractStatus.ACTIVE);

    // --- MODE 1: FAMILY TREE (Hierarchical by Relationships) ---
    if (viewMode === 'family') {
        // 1. Add Center Node
        nodes.push({
          id: centerCustomer.id,
          type: 'familyNode',
          data: { 
            label: centerCustomer.fullName, 
            role: 'Trung tâm', 
            isCenter: true, 
            gender: centerCustomer.gender,
            age: getAge(centerCustomer.dob),
            status: centerCustomer.status,
            hasActiveContract: checkActive(centerCustomer.id)
          },
          position: { x: 0, y: 0 }
        });
        processedIds.add(centerCustomer.id);

        // 2. Add Related Nodes based on Relationship List
        if (centerCustomer.relationships) {
            centerCustomer.relationships.forEach((rel) => {
                const relative = allCustomers.find(c => c.id === rel.relatedCustomerId);
                if (!relative || processedIds.has(relative.id)) return;

                let source = '';
                let target = '';
                let role = rel.relationship;

                // If Relative is PARENT -> Relative is Source, Center is Target
                if (rel.relationship === RelationshipType.PARENT) {
                    source = relative.id;
                    target = centerCustomer.id;
                } 
                // If Relative is CHILD -> Center is Source, Relative is Target
                else if (rel.relationship === RelationshipType.CHILD) {
                    source = centerCustomer.id;
                    target = relative.id;
                }
                // Other relationships
                else {
                    source = centerCustomer.id;
                    target = relative.id;
                }

                nodes.push({
                    id: relative.id,
                    type: 'familyNode',
                    data: { 
                        label: relative.fullName, 
                        role: role, 
                        isCenter: false,
                        gender: relative.gender,
                        age: getAge(relative.dob),
                        status: relative.status,
                        hasActiveContract: checkActive(relative.id)
                    },
                    position: { x: 0, y: 0 } // Position calculated by Dagre later
                });
                processedIds.add(relative.id);

                edges.push({
                    id: `e-${source}-${target}`,
                    source,
                    target,
                    type: 'smoothstep',
                    animated: false,
                    style: { stroke: '#9ca3af', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
                });
            });
        }
    } 
    // --- MODE 2: REFERRAL NETWORK (Graph by Referrer ID) ---
    else {
        // Calculate Referral Counts for VIP status (Global calculation)
        const referralCounts: Record<string, number> = {};
        allCustomers.forEach(c => {
            if(c.referrerId) referralCounts[c.referrerId] = (referralCounts[c.referrerId] || 0) + 1;
        });

        // We want to show:
        // 1. The Center Customer
        // 2. The Center's Referrer (The "Parent")
        // 3. People referred BY the Center (The "Children")
        
        const nodesToAdd = new Set<Customer>();
        nodesToAdd.add(centerCustomer);

        // Find Parent (Referrer)
        if (centerCustomer.referrerId) {
            const referrer = allCustomers.find(c => c.id === centerCustomer.referrerId);
            if (referrer) nodesToAdd.add(referrer);
        }

        // Find Children (Referees)
        allCustomers.forEach(c => {
            if (c.referrerId === centerCustomer.id) {
                nodesToAdd.add(c);
            }
        });

        // Create Nodes & Edges
        nodesToAdd.forEach(node => {
            const isCenter = node.id === centerCustomer.id;
            const refCount = referralCounts[node.id] || 0;
            const isVip = refCount >= 3; // Rule: Refer > 2 people = VIP

            // Determine Role Label relative to Center
            let roleLabel = 'Khách hàng';
            if (isCenter) roleLabel = 'Trung tâm';
            else if (node.id === centerCustomer.referrerId) roleLabel = 'Người giới thiệu (Upline)';
            else if (node.referrerId === centerCustomer.id) roleLabel = 'Được giới thiệu (F1)';

            nodes.push({
                id: node.id,
                type: 'familyNode',
                data: { 
                    label: node.fullName, 
                    role: roleLabel,
                    isCenter: isCenter, 
                    gender: node.gender,
                    age: getAge(node.dob),
                    status: node.status,
                    hasActiveContract: checkActive(node.id),
                    referralCount: refCount,
                    isVipReferrer: isVip
                },
                position: { x: 0, y: 0 }
            });

            // Create Edge (From Referrer TO This Node)
            if (node.referrerId && nodesToAdd.has(allCustomers.find(c => c.id === node.referrerId) as Customer)) {
                // Determine edge color based on conversion
                const isConverted = checkActive(node.id); // If the referee signed a contract
                const edgeColor = isConverted ? '#22c55e' : '#9ca3af'; // Green or Gray

                edges.push({
                    id: `e-ref-${node.referrerId}-${node.id}`,
                    source: node.referrerId,
                    target: node.id,
                    type: 'smoothstep',
                    animated: isConverted, // Animate if successful referral
                    style: { stroke: edgeColor, strokeWidth: 2, strokeDasharray: isConverted ? '0' : '5,5' },
                    label: isConverted ? 'Đã chốt' : 'Giới thiệu',
                    labelStyle: { fill: edgeColor, fontWeight: 700, fontSize: 10 },
                    labelBgStyle: { fillOpacity: 0.8, fill: '#fff' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
                });
            }
        });
    }

    return getLayoutedElements(nodes, edges);
  }, [centerCustomer, allCustomers, contracts, viewMode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Force Update when props or mode change
  React.useEffect(() => {
      setNodes(initialNodes);
      setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((event: any, node: Node) => {
      if (node.id !== centerCustomer.id) {
          navigate(`/customers/${node.id}`);
      }
  }, [navigate, centerCustomer.id]);

  return (
    <div className="h-[500px] w-full bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative group">
        {/* Top Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            {/* Legend */}
            <div className="bg-white/80 dark:bg-black/50 p-2 rounded-lg text-xs backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Đã có bảo hiểm</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-gray-400 border-dashed rounded-sm"></div><span>Chưa có (Tiềm năng)</span></div>
                {viewMode === 'referral' && (
                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-300 dark:border-gray-600">
                        <i className="fas fa-gem text-yellow-400 text-xs"></i><span>VIP (GT {'>'} 2 người)</span>
                    </div>
                )}
            </div>
        </div>

        {/* View Switcher */}
        <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex">
            <button 
                onClick={() => setViewMode('family')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition ${viewMode === 'family' ? 'bg-pru-red text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
                <i className="fas fa-sitemap"></i> Gia phả
            </button>
            <button 
                onClick={() => setViewMode('referral')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition ${viewMode === 'referral' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
                <i className="fas fa-project-diagram"></i> Mạng lưới GT
            </button>
        </div>

        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
        >
            <Background color="#ccc" gap={20} size={1} />
            <Controls />
        </ReactFlow>
    </div>
  );
};

export default FamilyTree;
