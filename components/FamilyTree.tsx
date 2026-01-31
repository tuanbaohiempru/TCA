
import React, { useMemo, useCallback } from 'react';
// Default import for the component
import ReactFlow, {
  Background,
  Controls,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle
} from 'reactflow';
// Explicit type imports
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { Customer, RelationshipType, CustomerStatus, Contract, ContractStatus } from '../types';
import { useNavigate } from 'react-router-dom';

interface FamilyTreeProps {
  centerCustomer: Customer;
  allCustomers: Customer[];
  contracts: Contract[];
}

// --- CUSTOM NODE COMPONENT ---
const FamilyNode = ({ data }: { data: any }) => {
  const isCenter = data.isCenter;
  const isSigned = data.status === CustomerStatus.SIGNED;
  const hasActiveContract = data.hasActiveContract;

  return (
    <div 
      className={`relative w-48 rounded-xl border-2 shadow-lg transition-all hover:scale-105 bg-white dark:bg-gray-800 ${
        isCenter 
          ? 'border-pru-red ring-4 ring-red-100 dark:ring-red-900/30' 
          : hasActiveContract 
            ? 'border-green-500' 
            : 'border-gray-300 dark:border-gray-600 border-dashed'
      }`}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-1 !rounded-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-3 !h-1 !rounded-none" />

      {/* Header Color Bar */}
      <div className={`h-2 w-full rounded-t-lg ${hasActiveContract ? 'bg-green-500' : 'bg-gray-300'}`}></div>

      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
             data.gender === 'Nữ' ? 'bg-pink-500' : 'bg-blue-600'
          }`}>
            {data.label.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate">{data.label}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">{data.role}</p>
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
  const nodeHeight = 100;

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

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const processedIds = new Set<string>();

    // Helper to get age
    const getAge = (dob: string) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
    
    // Helper to check active contract
    const checkActive = (cusId: string) => contracts.some(c => c.customerId === cusId && c.status === ContractStatus.ACTIVE);

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

            // Determine Direction based on Relationship
            // Parents -> Center -> Children
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
            // If SPOUSE or SIBLING -> Treat as "Same Rank" but using Dagre we link them for grouping
            // Usually simpler to link Center -> Relative for visualizing "My Family"
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

    return getLayoutedElements(nodes, edges);
  }, [centerCustomer, allCustomers, contracts]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((event: any, node: Node) => {
      if (node.id !== centerCustomer.id) {
          navigate(`/customers/${node.id}`);
      }
  }, [navigate, centerCustomer.id]);

  return (
    <div className="h-[500px] w-full bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-black/50 p-2 rounded-lg text-xs backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span>Đã có bảo hiểm</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-gray-400 border-dashed rounded-sm"></div><span>Chưa có (Tiềm năng)</span></div>
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
