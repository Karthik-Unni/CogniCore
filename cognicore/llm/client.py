import os
import json
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger("cognicore.llm")

class LLMClient:
    """
    Unified LLM Client wrapper supporting OpenAI, Gemini, Claude, Ollama, and a Mock fallback.
    """
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.provider = self.config.get("provider", "mock").lower()
        self.model = self.config.get("model", "")
        self.api_key = self.config.get("api_key") or os.environ.get("COGNICORE_API_KEY")
        self.api_url = self.config.get("api_url")
        
        # Set default models based on provider if not provided
        if not self.model:
            if self.provider == "openai":
                self.model = "gpt-4o-mini"
            elif self.provider == "gemini":
                self.model = "gemini-1.5-flash"
            elif self.provider == "claude":
                self.model = "claude-3-5-sonnet-20240620"
            elif self.provider == "ollama":
                self.model = "llama3"
            else:
                self.model = "mock-model"

        # Initialize provider-specific libraries if needed
        self._init_provider()

    def _init_provider(self):
        if self.provider == "openai":
            import openai
            self.client = openai.OpenAI(api_key=self.api_key, base_url=self.api_url)
        elif self.provider == "gemini":
            import google.generativeai as genai
            if self.api_key:
                genai.configure(api_key=self.api_key)
            self.client = genai
        elif self.provider == "claude":
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key, base_url=self.api_url)
        elif self.provider == "ollama":
            self.client = self.api_url or "http://localhost:11434"
        elif self.provider == "mock":
            self.client = None
            logger.info("CogniCore running in Mock LLM mode (no API key required).")
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def generate(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        """
        Generate completion text from prompt and system instructions.
        """
        try:
            if self.provider == "mock":
                return self._generate_mock(prompt, system_instruction, json_mode)
            elif self.provider == "openai":
                return self._generate_openai(prompt, system_instruction, json_mode)
            elif self.provider == "gemini":
                return self._generate_gemini(prompt, system_instruction, json_mode)
            elif self.provider == "claude":
                return self._generate_claude(prompt, system_instruction, json_mode)
            elif self.provider == "ollama":
                return self._generate_ollama(prompt, system_instruction, json_mode)
        except Exception as e:
            logger.error(f"LLM Error on provider {self.provider}: {str(e)}. Falling back to mock generator.")
            return self._generate_mock(prompt, system_instruction, json_mode)

    def _generate_openai(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        response_format = {"type": "json_object"} if json_mode else None

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format=response_format,
            temperature=0.7
        )
        return response.choices[0].message.content

    def _generate_gemini(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        generation_config = {}
        if json_mode:
            generation_config["response_mime_type"] = "application/json"

        # Using google-generativeai API
        model = self.client.GenerativeModel(
            model_name=self.model,
            system_instruction=system_instruction,
            generation_config=generation_config
        )
        response = model.generate_content(prompt)
        return response.text

    def _generate_claude(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        # Claude expects system parameter separately
        kwargs = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        if system_instruction:
            kwargs["system"] = system_instruction
            
        response = self.client.messages.create(**kwargs)
        return response.content[0].text

    def _generate_ollama(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        url = f"{self.client}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.7}
        }
        if system_instruction:
            payload["system"] = system_instruction
        if json_mode:
            payload["format"] = "json"

        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        return response.json().get("response", "")

    def _generate_mock(self, prompt: str, system_instruction: Optional[str] = None, json_mode: bool = False) -> str:
        """
        Local deterministic text generator that matches the simulation's structure and expected formats.
        """
        # Look for keywords in the prompt to return sensible mock responses
        p_lower = prompt.lower()
        
        # 1. Planning/Action selection
        if "plan" in p_lower or "choose action" in p_lower or "next step" in p_lower:
            # Check what character this is from prompt (if mentioned)
            char_name = "Marcus"
            for name in ["Alden", "Katherine", "Marcus", "Dennis", "Clara", "Elena", "Silas", "Gerald"]:
                if name.lower() in p_lower:
                    char_name = name
                    break

            if json_mode:
                return json.dumps({
                    "reasoning": f"As {char_name}, I need to ensure my goals are met given my personality and the current situation.",
                    "plan": [f"Go to Tavern", f"Talk to other villagers", f"Investigate clues"],
                    "action": {
                        "type": "MOVE",
                        "target": "Tavern",
                        "metadata": {"reason": "Gather rumors and update alibi"}
                    }
                })
            else:
                return f"Reasoning: I must protect myself.\nPlan: Move to Tavern, chat with Elena.\nAction: MOVE to Tavern."

        # 2. Dialogue / Interrogation response
        if "interrogat" in p_lower or "question" in p_lower or "ask" in p_lower or "dialogue" in p_lower:
            char_name = "the villager"
            for name in ["Alden", "Katherine", "Marcus", "Dennis", "Clara", "Elena", "Silas", "Gerald"]:
                if name.lower() in p_lower:
                    char_name = name
                    break
            
            # Formulate dialogue response
            if json_mode:
                return json.dumps({
                    "response": f"I don't know much about the murder, detective. I was at my usual spot when it happened.",
                    "emotion_impact": {"fear": 0.1, "suspicion": 0.05},
                    "relationship_changes": {"Player": -0.05},
                    "lies_told": False,
                    "secrets_revealed": []
                })
            else:
                return f"\"I have nothing to hide. Speak to the others if you want alibis.\""

        # 3. Rumor Mutation / Gossip
        if "rumor" in p_lower or "gossip" in p_lower:
            if json_mode:
                return json.dumps({
                    "mutated_rumor": "I heard something suspicious happened near the Blacksmith's forge last night.",
                    "fidelity": 0.9
                })
            return "I heard someone saw something suspicious near the forge last night."

        # 4. Generic JSON request fallback
        if json_mode:
            return json.dumps({
                "reasoning": "Fallback mock reasoning.",
                "status": "success",
                "result": "Default mock response"
            })
            
        return "I am keeping a close eye on the events unfolding in the village."
