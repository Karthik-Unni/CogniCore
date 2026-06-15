from typing import List, Dict, Any

class SocialGraph:
    """
    Combines subjective relationships from individual agents to construct
    a global social network representation for dashboard visualization.
    """
    def __init__(self, agents: List[Any]):
        self.agents = agents

    def export_graph_json(self) -> Dict[str, Any]:
        """
        Exports nodes and edges in a format readable by visualization libraries (like Vis.js or D3).
        """
        nodes = []
        edges = []

        for agent in self.agents:
            # Create node
            nodes.append({
                "id": agent.id,
                "label": agent.name,
                "role": agent.metadata.get("role", "Villager"),
                "emotions": agent.emotions.get_state()
            })

            # Create directed edges based on agent's subjective relationships
            relationships = agent.relationships.get_all_relationships()
            for target_id, metrics in relationships.items():
                # Only add edge if there are significant relationship values (non-zero)
                # or if we want to show all. For clarity, let's filter out weak links 
                # or just export them with weights.
                
                # Find dominant relationship type for labeling
                # (e.g. if friendship is high, label "friend", if trust is low, label "distrusts")
                primary_label = ""
                friendship = metrics.get("friendship", 0.0)
                trust = metrics.get("trust", 0.0)
                fear = metrics.get("fear", 0.0)
                rivalry = metrics.get("rivalry", 0.0)

                # Determine a user-friendly summary label for the link
                if friendship > 0.4:
                    primary_label = "Friend"
                elif friendship < -0.4:
                    primary_label = "Enemy"
                elif trust < -0.4:
                    primary_label = "Distrusts"
                elif trust > 0.4:
                    primary_label = "Trusts"
                elif fear > 0.4:
                    primary_label = "Fears"
                elif rivalry > 0.4:
                    primary_label = "Rival"
                
                edges.append({
                    "from": agent.id,
                    "to": target_id,
                    "label": primary_label,
                    "metrics": metrics
                })

        return {
            "nodes": nodes,
            "edges": edges
        }
