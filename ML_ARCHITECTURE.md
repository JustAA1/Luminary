# Luminary ML Architecture (1-Minute Technical Pitch)

**[0:00 - 0:15] The Architecture**
"Hi everyone. Luminary isn't just a wrapper—it's a custom, four-phase Machine Learning pipeline built natively in PyTorch and deployed via Supabase. We ingest user resumes and real-time chat signals to dynamically generate and sequence a personalized knowledge graph using strict Topological Sorting."

**[0:15 - 0:35] The Deep Learning Layers**
"At the core, we engineered three specialized neural networks. First, the **UserProfile MLP** embeds a user's skills into a 128-dimensional dense space, trained using *Triplet Margin Loss* to pull users toward topics they've mastered and push them away from concepts they aren't ready for. Second, our **TrendGRU** processes variable-length sequences of historical signal strengths, analyzing if a user's comprehension in a specific domain is rising, stable, or fading."

**[0:35 - 0:50] The Multi-Head Classifier & LLM**
"Third, as users interact, our **Signal Classifier**—a multi-head neural network with residual connections—extracts text embeddings and simultaneously predicts the relevant topic, the signal's strength, and whether it's new info or a contradiction. Finally, we pass this rigorously scored matrix to Gemini 2.5 Flash, which appends natural-language 'Why this matters' contextual tips to the nodes."

**[0:50 - 1:00] The Impact**
"By combining deep recurrent networks for temporal sequence tracking, custom PyTorch classifiers for real-time metric scoring, and LLMs for localized explanations, Luminary structurally adapts to the human brain. Thank you."
