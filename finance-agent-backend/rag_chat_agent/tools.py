from langchain_tavily import TavilySearch

# Initialize the search engine
search_tool = TavilySearch(max_results=3)

tool_array = [search_tool]

