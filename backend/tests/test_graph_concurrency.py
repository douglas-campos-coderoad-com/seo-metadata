import pytest
from src.services.analysis_service import AnalysisService
from src.services.graph_nodes import compile_report


@pytest.mark.asyncio
async def test_langgraph_parallel_branch_state_merging(db_session_factory):
    """Verify that compile_report receives outputs from both analyze_seo_geo and generate_json_ld branches."""
    async with db_session_factory() as session:
        service = AnalysisService(session)
        compiled_graph = service._build_graph()

    sample_html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Parallel Graph Concurrency Test Page</title>
        <meta name="description" content="Testing parallel branch merging across LangGraph nodes.">
        <link rel="canonical" href="https://example.com/test">
    </head>
    <body>
        <h1>Test Main Heading</h1>
        <p>Visible content for testing state compilation.</p>
    </body>
    </html>
    '''

    initial_state = {
        'html': sample_html,
        'url': 'https://example.com/test',
    }

    # Execute graph synchronously
    result = compiled_graph.invoke(initial_state)

    # Verify both analyze_seo_geo state (seo_score, geo_score, analysis) and generate_json_ld state (json_ld) merged
    assert 'seo_score' in result
    assert 'geo_score' in result
    assert 'overall_score' in result
    assert 'json_ld' in result
    assert result['status'] in ('completed', 'failed')

    # Directly verify compile_report logic with pre-merged state
    synthetic_state = {
        'seo_score': 80,
        'geo_score': 60,
        'findings': [{'id': 'F1', 'title': 'Test Finding'}],
        'recommendations': [{'id': 'R1', 'action': 'Test Recommendation'}],
        'geo_visibility': 'High visibility',
        'seo_breakdown': {'title': 10},
        'geo_breakdown': {'question_answering': 15},
        'json_ld': {'@context': 'https://schema.org', '@type': 'WebPage'},
        'parse_error': None,
        'seo_geo_error': None,
        'json_ld_error': None,
    }

    compiled_output = compile_report(synthetic_state)
    assert compiled_output['seo_score'] == 80
    assert compiled_output['geo_score'] == 60
    assert compiled_output['overall_score'] == 70  # average of 80 and 60
    assert compiled_output['json_ld'] == synthetic_state['json_ld']
    assert compiled_output['status'] == 'completed'
